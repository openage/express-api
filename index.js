'use strict'
const pathExists = require('path-exists')
const appRoot = require('app-root-path')
const formidable = require('formidable');
const logger = require('@open-age/logger')()

const apiConfig = require('config').api || {}

apiConfig.dir = apiConfig.dir || 'api'
apiConfig.root = apiConfig.root || 'api'

apiConfig.validators = apiConfig.validators || {}
apiConfig.validators.dir = apiConfig.validators.dir || 'validators'

apiConfig.importers = apiConfig.importers || {}
apiConfig.importers.dir = apiConfig.importers.dir || 'importers'
apiConfig.importers.defaultFile = apiConfig.importers.defaultFile || 'default'

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
                message: '',
                error: ''
            }

            if (message) {
                val.message = message
            } else if ('errors' in apiConfig) {
                val.message = apiConfig.errors[error] || 'Internal Server Error'
            } else if (error) {
                val.error = error.toString()
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

const importViaConfig = async(req, file, handler) => {
    let type = 'csv'
    switch (file.type) {
    case 'text/csv':
        type = 'csv'
        break
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        type = 'xlsx'
        break
    default:
        throw new Error(`file type '${file.type}' is not supported`)
    }

    const format = req.query['format'] || apiConfig.importers.defaultFile

    let config = await handler.config(req, { format: format, type: type })

    let rows = await require(`./parsers/${type}`).parse(file, config).rows()

    if (!config.modelMap) {
        return rows
    }
    const items = []

    for (const row of rows) {
        let mappedItem = config.modelMap(row, config, req)
        if (!mappedItem) {
            continue
        }
        items.push(mappedItem)
    }
    return items
}

const importerFn = (apiName, action) => {
    if (action !== '/bulk') {
        return null
    }

    return function (req, res, next) {

        if (req.body.items) {
            return next()
        }

        const logger = res.log.start(`${apiConfig.importers.dir}/importers/${apiName}`)

        return fileWrapper(req).then(file => {

            if (!file) {
                return next()
            }

            logger.debug(`got a file '${file.name}' to extract`)
            const ext = file.name.split('.')[1]

            const format = req.query['format'] || apiConfig.importers.defaultFile

            let handlerFile = `${appRoot}/${apiConfig.importers.dir}/${apiName}/${ext}/${format}`

            if (!pathExists.sync(`${handlerFile}.js`)) {
                handlerFile = `${appRoot}/${apiConfig.importers.dir}/${apiName}/${ext}`
                if (!pathExists.sync(`${handlerFile}.js`)) {
                    handlerFile = `${appRoot}/${apiConfig.importers.dir}/${apiName}`
                    if (!pathExists.sync(`${handlerFile}.js`)) {
                        logger.debug(`importer '${handlerFile}' does not exist `)
                        return next()
                    }
                }
            }

            let handler = require(handlerFile)

            let handerPromise

            if (handler.config) {
                handerPromise = importViaConfig(req, file, handler)
            } else if (handler.import) {
                handerPromise = handler.import(req, file, format, ext)
            } else {
                logger.error(`importer '${handlerFile}' does not implement import `)
                return next()
            }

            return handerPromise.then(items => {
                req.body.items = items
                logger.end()
                next()
            }).catch(err => {
                logger.error(err)
                logger.end()
                return next(err)
            })
        }).catch(err => {
            logger.error(err)
            logger.end()
            return next(err)
        })
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
                    validator: validatorFn(params.model, methodName),
                    importer: importerFn(params.model, handlerOption.url),
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

            if (handlerOptions.importer) {
                fnArray.push(handlerOptions.importer)
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


const fileWrapper = (req) => {
    return new Promise((resolve, reject) => {
        var form = new formidable.IncomingForm();

        form.parse(req, function (err, fields, incomingFiles) {
            if (err) {
                reject(err)
            }
            let keys = Object.keys(incomingFiles)
            const files = []

            keys.forEach(key => files.push(incomingFiles[key]))
            if (files.length === 0) {
                resolve(null)
            } else {
                resolve(files[0]);
            }
        })
    })
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
