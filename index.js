'use strict'
const appRoot = require('app-root-path')
const requestHelper = require('./middlewares/request')
const validationHelper = require('./middlewares/validation')
const bulkHelper = require('./middlewares/bulk')
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

            fnArray.push((req, res, next) => {
                let permissions = req.context.config.get(`api.${handlerOptions.code}.permissions`, handlerOptions.permissions)
                if (!req.context.hasPermission(permissions)) {
                    res.accessDenied()
                } else {
                    next()
                }
            })
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
                handlerOptions.cache = null
                let cache = req.context.config.get(`api.${handlerOptions.code}.cache`, handlerOptions.cache)
                req.context.cache = { ...req.context.cache, ...cache }
                if (cache) {
                    if (cache.action == "add" && cache.key) {
                        req.context.cache.key = cache.key.inject(req, req.context)
                    }

                    if (cache.action == "add") {
                        let log = req.context.logger.start('add-cache')
                        try {
                            req.context.retVal = await req.context.cache.get(`${req.context.service}:${req.context.cache.key}`)
                            if (req.context.retVal) {
                                req.context.fetchedFromCache = true
                            }
                        } catch (err) {
                            log.error(err)
                        }
                        log.end()
                    }
                    if (cache.action == "remove") {
                        let log = req.context.logger.start('remove-cache')
                        try {
                            for (let k of req.context.cache.key) {
                                k = k.inject(req, req.context)
                                await req.context.cache.remove(`${req.context.service}:${k}`)
                            }
                        } catch (err) {
                            log.end()
                            res.failure(err)
                        }
                        log.end()
                    }
                }
                next()
            })

            fnArray.push((req, res, next) => {
                let logger = req.context.logger.start('api')
                try {
                    let retValue
                    if (!req.context.fetchedFromCache) {
                        retValue = handlerOptions.method(req, res)
                    }

                    if (retValue && retValue.then && typeof retValue.then === 'function') {
                        return retValue.then(value => {
                            logger.end()
                            req.context.retVal = value
                            next()
                        }).catch(err => {
                            logger.end()
                            res.failure(err)
                        })
                    } else if (req.context.retVal) {
                        next()
                    }
                } catch (err) {
                    logger.end()
                    res.failure(err)
                }
            })

            fnArray.push((req, res, next) => {
                let retValue = req.context.retVal
                let cache = req.context.cache
                if (res.finished || retValue === undefined) {
                    return
                }
                let doCache = checkIfCache(req, cache, handlerOptions, retValue)
                if (typeof retValue === 'string' || retValue === null) {
                    res.success(retValue)
                } else if (retValue instanceof Array) {
                    if (doCache)
                        cache.set(`${req.context.service}:${cache.key}`, retValue, cache.ttl)
                    res.page(retValue)
                } else if (retValue.items) {
                    if (doCache)
                        cache.set(`${req.context.service}:${cache.key}`, retValue, cache.ttl)
                    res.page(retValue.items, retValue.pageSize, retValue.pageNo, retValue.total, retValue.stats)
                } else {
                    if (doCache)
                        cache.set(`${req.context.service}:${cache.key}`, retValue, cache.ttl)
                    res.data(retValue)
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
const checkIfCache = (req, cache, handlerOptions, value) => {
    let doCache = false
    if (!req.context.fetchedFromCache && cache.key && handlerOptions.action == "GET" && cache.action == "add") {
        if (cache.condition) {
            doCache = req.context.ruleValidator.check(req, cache.condition)
        } else {
            if (!(value instanceof Array || value.items)) {
                doCache = true
            }
        }
    }

    return doCache
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
