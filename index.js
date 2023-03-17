'use strict'
const appRoot = require('app-root-path')
const requestHelper = require('./middlewares/request')
const validationHelper = require('./middlewares/validation')
const bulkHelper = require('./middlewares/bulk')
require('./helpers/string')
require('./helpers/cache')

const about = require('../../../package.json')


const apiConfig = JSON.parse(JSON.stringify(require('config').api || {}))

apiConfig.dir = apiConfig.dir || 'api'
apiConfig.root = apiConfig.root || 'api'

const getCacheConfig = (req, handlerOptions) => {

    let context = req.context

    let cache = context.config.get(`api.${handlerOptions.code}.cache`, handlerOptions.cache)

    if (!cache) {
        return
    }
    let keys = []

    cache.keys = cache.keys || cache.key

    if (!Array.isArray(cache.keys)) {
        cache.keys = [cache.keys]
    }


    for (const key of cache.keys) {
        keys.push(`${about.name}:${key.inject(req, context)}`)
    }

    cache.keys = keys

    if (cache.condition && !req.context.ruleValidator.check(req, cache.condition)) {
        return
    }

    if (!cache.keys || !cache.keys.length) {
        return
    }

    // TODO
    cache.action = cache.action || 'set'

    return cache
}

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

const getApiResp = (handlerOptions, req, res) => {
    return new Promise((resolve, rejects) => {
        handlerOptions.method(req, res).then(value => {
            resolve(value)
        }).catch(err => {
            rejects(err)
        })
    })
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
                let logger = req.context.logger.start('api')
                try {

                    let cacheConfig = getCacheConfig(req, handlerOptions)
                    let cache = req.context.cache

                    let retValue
                    let isCached = false
                    try {
                        if (handlerOptions.action === "GET" && cacheConfig) {
                            retValue = await req.context.cache.get(cacheConfig.keys[0])
                            if (retValue){
                                isCached = true
                            }
                        }

                        if (!retValue) {
                            retValue = await getApiResp(handlerOptions, req, res)
                        }
                        logger.end()
                        if (res.finished || retValue === undefined) {
                            return
                        }

                        if (typeof retValue === 'string' || retValue === null) {
                            res.success(retValue)
                        } else if (retValue instanceof Array) {
                            if (!isCached && cacheConfig) {
                                for (const key of cacheConfig.keys) {
                                    await cache[cacheConfig.action](key, retValue, cacheConfig.ttl)
                                }
                            }
                            res.page(retValue)
                        } else if (retValue.items) {
                            if (!isCached && cacheConfig) {
                                for (const key of cacheConfig.keys) {
                                    await cache[cacheConfig.action](key, retValue, cacheConfig.ttl)
                                }
                            }
                            res.page(retValue.items, retValue.pageSize, retValue.pageNo, retValue.total, retValue.stats)
                        } else {
                            if (!isCached && cacheConfig) {
                                for (const key of cacheConfig.keys) {
                                    await cache[cacheConfig.action](key, retValue, cacheConfig.ttl)
                                }
                            }
                            res.data(retValue)
                        }
                    } catch (err) {
                        logger.end()
                        res.failure(err)
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
