'use strict'
const appRoot = require('app-root-path')
const requestHelper = require('./middlewares/request')
const validationHelper = require('./middlewares/validation')
const bulkHelper = require('./middlewares/bulk')

const apiConfig = require('config').api || {}

apiConfig.dir = apiConfig.dir || 'api'
apiConfig.root = apiConfig.root || 'api'

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
                    validator: validationHelper.getMiddlware(params.model, methodName),
                    importer: bulkHelper.getMiddleware(params.model, handlerOption.url),
                    filter: handlerOption.filter,
                    method: method
                }

                return val
            }

            let handlerParams = {}

            if (options.action) {
                handlerParams = getHandlerOptions(options)
                handlerParams.filter = handlerParams.filter || param1
                withApp(app).register(handlerParams)
            } else if (options instanceof Array) {
                options.forEach((option) => {
                    handlerParams = getHandlerOptions(option)
                    handlerParams.filter = handlerParams.filter || param1
                    withApp(app).register(handlerParams)
                })
            } else if (options instanceof String || typeof options === 'string') {
                if (options.toUpperCase() === 'REST' || options.toUpperCase() === 'CRUD') {
                    crudOptions(param1).forEach((option) => {
                        withApp(app).register(getHandlerOptions(option))
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
                    withApp(app).register(handlerParams)
                }
            }
            return routes
        }
        return routes
    }
    return self
}

var withApp = function (app) {
    return {
        register: function (handlerOptions) {
            if (!handlerOptions.method) {
                return // the method may not exist at this time;
            }
            let fnArray = []
            fnArray.push(requestHelper.middleware)

            if (handlerOptions.filter) {
                if (handlerOptions.filter instanceof Array) {
                    handlerOptions.filter.forEach((filter) => {
                        fnArray.push(filter)
                    })
                } else {
                    fnArray.push(handlerOptions.filter)
                }
            }

            if (handlerOptions.importer) {
                fnArray.push(handlerOptions.importer)
            }

            if (handlerOptions.validator) {
                fnArray.push(handlerOptions.validator)
            }

            fnArray.push((req, res) => {
                let logger = req.context.logger.start('api')
                try {
                    let retVal = handlerOptions.method(req, res)

                    if (retVal && retVal.then && typeof retVal.then === 'function') {
                        return retVal.then(value => {
                            logger.end()
                            if (res.finished || value === undefined) {
                                return
                            }
                            if (typeof value === 'string' || value === null) {
                                res.success(value)
                            } else if (value instanceof Array) {
                                res.page(value)
                            } else if (value.items) {
                                res.page(value.items, value.pageSize, value.pageNo, value.total)
                            } else {
                                res.data(value)
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
