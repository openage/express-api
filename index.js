'use strict'
const pathExists = require('path-exists')
const appRoot = require('app-root-path')
const logger = require('@open-age/logger')()

const apiConfig = require('config').api || {}

apiConfig.dir = apiConfig.dir || 'api'
apiConfig.root = apiConfig.root || 'api'
apiConfig.validators = apiConfig.validators || {}
apiConfig.validators.dir = apiConfig.validators.dir || 'validators'

const responseHelper = function (res) {
    return {
        success: function (message, code) {
            let val = {
                isSuccess: true,
                message: message,
                code: code
            }
            res.log.info(message || 'success', val)
            res.log.end()
            res.json(val)
        },
        failure: function (error, message) {
            let val = {
                isSuccess: false,
                message: message || 'errors' in apiConfig ? apiConfig.errors[error] : message,
                error: error
            }

            res.log.error(message || 'failed', error)
            res.log.end()

            res.json(val)
        },
        accessDenied: function (error, message) {
            res.status(error.status || 400)
            let val = {
                isSuccess: false,
                message: message,
                error: error
            }
            res.log.error(message || 'failed', val)
            res.log.end()

            res.json(val)
        },
        data: function (item, message, code) {
            let val = {
                isSuccess: true,
                message: message,
                data: item,
                code: code
            }
            res.log.info(message || 'success', val)
            res.log.end()

            res.json(val)
        },
        page: function (items, pageSize, pageNo, total) {
            let val = {
                isSuccess: true,
                pageNo: pageNo || 1,
                items: items,
                total: total || items.length || pageSize, // TODO: obsolete
                pageSize: pageSize || items.length,
                totalRecords: total, // TODO: obsolete
                count: total
            }

            res.log.info('page', val)
            res.log.end()
            res.json(val)
        }
    }
}

const validatorFn = function (apiName, action) {
    const actionValidator = 'can' + action.charAt(0).toUpperCase() + action.slice(1)
    const validator = `${appRoot}/${apiConfig.validators.dir}/${apiName}`

    if (!pathExists.sync(`${validator}.js`)) {
        return null
    }
    let fn = require(validator)[actionValidator]
    if (!fn) {
        return null
    }

    return function (req, res, next) {
        const logger = res.log.start(`${apiConfig.validators.dir}/${apiName}:${actionValidator}`)

        let handled = false
        let callback = function (err) {
            if (handled) { return }
            handled = true
            if (err) {
                logger.error(err)
                logger.end()
                res.failure(err)
                return
            }
            logger.end()
            logger.silly(`passed`)
            next()
        }

        let promise = fn(req, callback)

        if (promise) {
            promise.then(errMessage => {
                if (handled) { return }
                handled = true
                if (errMessage) {
                    logger.error(errMessage)
                    logger.end()
                    res.failure(errMessage)
                    return
                }
                logger.silly(`passed`)
                logger.end()
                next()
            }).catch(err => {
                if (handled) return
                handled = true
                logger.error(err)
                logger.end()
                res.failure(err)
            })
        }
    }
}

const responseDecoratorFn = function (req, res, next) {
    res.logger = logger.start(req.method + ' ' + req.url)
    res.log = res.logger // TODO: obsolete
    if (req.body) {
        res.log.debug(req.body)
    }

    let wrapper = responseHelper(res)
    res.accessDenied = wrapper.accessDenied
    res.failure = wrapper.failure
    res.success = wrapper.success
    res.page = wrapper.page
    res.data = wrapper.data
    next()
}

const requestDecoratorFn = function (req, res, next) {
    let where = {}
    req.filters = {
        add: function (field, value) {
            where[field] = value
            return req.filters
        }
    }
    req.filters.where = where
    return next()
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
            let getHandlerOptions = function (handlerOption) {
                let method = null
                if (handlerOption.method instanceof String || typeof handlerOption.method === 'string') {
                    method = require(`${appRoot}/${apiOptions.root || apiConfig.dir}/${params.controller}`)[handlerOption.method]
                } else {
                    method = handlerOption.method
                }

                let val = {
                    action: handlerOption.action.toUpperCase(),
                    url: routeBase + (handlerOption.url || ''),
                    validator: validatorFn(params.model, handlerOption.method),
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
            fnArray.push(responseDecoratorFn)
            fnArray.push(requestDecoratorFn)

            if (handlerOptions.filter) {
                if (handlerOptions.filter instanceof Array) {
                    handlerOptions.filter.forEach((filter) => {
                        fnArray.push(filter)
                    })
                } else {
                    fnArray.push(handlerOptions.filter)
                }
            }
            if (handlerOptions.validator) {
                fnArray.push(handlerOptions.validator)
            }

            fnArray.push((req, res) => {
                let logger = res.logger.start('api')
                try {
                    let retVal = handlerOptions.method(req, res)

                    if (retVal && retVal.then && typeof retVal.then === 'function') {
                        return retVal.then(value => {
                            logger.end()
                            if (res.finished || value === undefined) {
                                return;
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
