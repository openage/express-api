'use strict'
const appRoot = require('app-root-path')
const requestHelper = require('./middlewares/request')
const validationHelper = require('./middlewares/validation')
const bulkHelper = require('./middlewares/bulk')
const ruleValidator = require('./helpers/rule-validator')
require('./helpers/string')
require('./helpers/cache')


const apiConfig = JSON.parse(JSON.stringify(require('config').api || {}))

apiConfig.dir = apiConfig.dir || 'api'
apiConfig.root = apiConfig.root || 'api'

const extractMiddlewares = (middlewares) => {
    const parseMiddleware = (item) => {
        if (typeof item === 'function') {
            return [item]
        }

        if (item instanceof Array) {
            return item.map(i => parseMiddleware(i))
        }

        if (item.permissions) {
            return [(req, res, next) => {
                if (!req.context.hasPermission(item.permissions)) {
                    res.accessDenied()
                } else {
                    next()
                }
            }]
        }
        return []
    }

    if (!middlewares) {
        return []
    }
    if (middlewares instanceof Array) {
        return middlewares.map(i => parseMiddleware(i))
    }
    return [parseMiddleware(middlewares)]
}

module.exports = function (app, apiOptions) {
    apiOptions = apiOptions || {}
    let self = {}
    self.model = function (params) {
        if (!params.root) {
            params = {
                root: params,
                controller: params,
                model: params
            }
        } else if (!params.model) {
            params.model = params.controller
        }
        let routeBase = `/${apiOptions.root || apiConfig.root}/${params.root}`

        let routes = {}
        routes.register = function (options, param1, param2, param3) {
            let getHandlerOptions = (handlerOption) => {
                let method = null
                let methodName = null
                if (handlerOption.method instanceof String || typeof handlerOption.method === 'string') {
                    methodName = handlerOption.method
                    method = require(`${appRoot}/${apiOptions.root || apiConfig.dir}/${params.controller}`)[handlerOption.method]
                } else {
                    methodName = handlerOption.method.name
                    method = handlerOption.method
                }

                let val = {
                    action: handlerOption.action.toUpperCase(),
                    url: routeBase + (handlerOption.url || ''),
                    permissions: handlerOption.permissions,
                    validator: validationHelper.getMiddlware(params.model, methodName),
                    importer: bulkHelper.getMiddleware(params.model, handlerOption.url),
                    filter: handlerOption.filter,
                    method: method,
                    cache: handlerOption.cache,
                    code: handlerOption.code
                }

                return val
            }

            let handlerParams = {}

            if (options.action) {
                handlerParams = getHandlerOptions(options)
                handlerParams.filter = handlerParams.filter || param1
                withApp(app, apiOptions).register(handlerParams)
            } else if (options instanceof Array) {
                options.forEach((option) => {
                    handlerParams = getHandlerOptions(option)
                    handlerParams.filter = handlerParams.filter || param1
                    withApp(app, apiOptions).register(handlerParams)
                })
            } else if (options instanceof String || typeof options === 'string') {
                if (options.toUpperCase() === 'REST' || options.toUpperCase() === 'CRUD') {
                    crudOptions(param1).forEach((option) => {
                        withApp(app, apiOptions).register(getHandlerOptions(option))
                    })
                } else {
                    handlerParams.action = options.toUpperCase()
                    if (param1 instanceof String || typeof param1 === 'string') {
                        handlerParams.url = routeBase + param1
                        handlerParams.method = param2
                        handlerParams.filter = param3
                    } else {
                        handlerParams.url = routeBase
                        handlerParams.method = param1
                        handlerParams.filter = param2
                    }
                    withApp(app, apiOptions).register(handlerParams)
                }
            }
            return routes
        }
        return routes
    }
    return self
}

var withApp = function (app, apiOptions) {
    return {
        register: function (handlerOptions) {
            if (!handlerOptions.method) {
                return // the method may not exist at this time;
            }
            let fnArray = []
            fnArray.push(requestHelper.getMiddleware(apiOptions))

            // let permissions = req.context.config.get(`api.${code}.permissions`,handlerOptions.permissions)
            if (handlerOptions.permissions) {
                fnArray.push((req, res, next) => {
                    if (!req.context.hasPermission(handlerOptions.permissions)) {
                        res.accessDenied()
                    } else {
                        next()
                    }
                })
            }
            if (handlerOptions.filter) {
                fnArray.push(...extractMiddlewares(handlerOptions.filter))
            }

            if (handlerOptions.importer) {
                fnArray.push(handlerOptions.importer)
            }

            if (handlerOptions.validator) {
                fnArray.push(handlerOptions.validator)
            }

            fnArray.push(async (req, res, next) => {
                handlerOptions.cache = handlerOptions.cache || {}
                if (handlerOptions.action == "GET" && handlerOptions.code) {
                    let cache = req.context.config.get(`api.${handlerOptions.code}.cache`, handlerOptions.cache)
                    req.context.cache = { ...req.context.cache, ...cache, httpAction: 'GET'}
                    if (handlerOptions.cache.action == "add") {
                        req.context.cache.key = req.context.cache.key.inject(req, req.context)
                        if (handlerOptions.cache.condition) {
                            req.context.doCache = ruleValidator.check(req, handlerOptions.cache.condition)
                        }
                    }
                }
                next()
            })

            fnArray.push(async (req, res, next) => {
                if (handlerOptions.cache && handlerOptions.cache.action == "add") {
                    let log = req.context.logger.start('add-cache')
                    try {
                        let retVal = await req.context.cache.get(`${req.context.service}:${req.context.cache.key}`)
                        if (retVal) {
                            return res.json(retVal)
                        }
                    } catch (err) {
                        log.error(err)
                    }
                    log.end()
                }
                next()
            })

            if (handlerOptions.cache && handlerOptions.cache.action == "remove") {
                fnArray.push(async (req, res, next) => {
                    let log = req.context.logger.start('remove-cache')
                    try {
                        for(let k of handlerOptions.cache.key){
                            k = k.inject(req, req.context)
                            await req.context.cache.remove(`${req.context.service}:${k}`)
                        }
                    } catch (err) {
                        log.end()
                        res.failure(err)
                    }
                    log.end()
                    next()

                })
            }

            fnArray.push((req, res, next) => {
                let logger = req.context.logger.start('api')
                try {
                    let retVal = handlerOptions.method(req, res)

                    if (retVal && retVal.then && typeof retVal.then === 'function') {
                        return retVal.then(value => {
                            logger.end()
                            if (res.finished || retVal === undefined) {
                                return
                            }
                            retVal = value
                            if (typeof retVal === 'string' || retVal === null) {
                                res.success(retVal)
                            } else if (retVal instanceof Array) {
                                res.page(retVal)
                            } else if (retVal.items) {
                                res.page(retVal.items, retVal.pageSize, retVal.pageNo, retVal.total, retVal.stats)
                            } else {
                                res.data(retVal)
                            }
                        }).catch(err => {
                            logger.end()
                            res.failure(err)
                        })
                    }
                } catch (err) {
                    logger.end()
                    res.failure(err)
                }
            })

            switch (handlerOptions.action.toUpperCase()) {
                case 'GET':

                    app.get(handlerOptions.url, fnArray)
                    break

                case 'POST':
                    app.post(handlerOptions.url, fnArray)
                    break

                case 'PUT':
                    app.put(handlerOptions.url, fnArray)
                    break

                case 'DELETE':
                    app.delete(handlerOptions.url, fnArray)
                    break

                default:
                    break
            }
        }
    }
}

var crudOptions = function (filterFn) {
    return [{
        action: 'GET',
        method: 'search',
        filter: filterFn
    }, {
        action: 'GET',
        url: '/:id',
        method: 'get',
        filter: filterFn
    }, {
        action: 'POST',
        method: 'create',
        filter: filterFn
    }, {
        action: 'POST',
        method: 'bulk',
        url: '/bulk',
        filter: filterFn
    }, {
        action: 'PUT',
        url: '/:id',
        method: 'update',
        filter: filterFn
    }, {
        action: 'DELETE',
        url: '/:id',
        method: 'delete',
        filter: filterFn
    }]
}
