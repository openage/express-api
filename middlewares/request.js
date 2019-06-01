const moment = require('moment')
const appRoot = require('app-root-path')

const logger = require('@open-age/logger')()

const apiConfig = require('config').api || {}
const claimsParser = require('../parsers/claims')

const decorateResponse = (res, log) => {
    res.success = (message, code, version) => {
        let val = {
            isSuccess: true,
            message: message,
            code: code,
            version: version
        }
        log.silly(message || 'success', val)
        log.end()
        res.json(val)
    }
    res.failure = (error, message) => {
        if (error.status) {
            res.status(error.status)
        }

        let val = {
            isSuccess: false,
            message: message || 'Internal Server Error',
            error: 'UNKNOWN',
            code: 'UNKNOWN'
        }

        if ('errors' in apiConfig && error) {
            let errorCode = (error.code || error.message || error).toUpperCase()

            let userMessage = apiConfig.errors[errorCode]
            if (userMessage) {
                val.message = userMessage
                val.code = errorCode
                val.error = errorCode
            }
        } else if (error) {
            if (typeof error === 'string') {
                val.error = error
            } else {
                val.message = error.message
                val.code = error.code
                val.error = val.code
            }
        }

        log.error(message || 'failed', error)
        log.end()

        res.json(val)
    }
    res.accessDenied = (error, message) => {
        let errorStatus = 400
        if (error && error.status) {
            errorStatus = error.status
        }
        res.status(errorStatus)
        let val = {
            isSuccess: false,
            message: message || 'Insufficient Permission',
            error: 'ACCESS_DENIED',
            code: 'ACCESS_DENIED'
        }

        if ('errors' in apiConfig && error) {
            let errorCode = (error.code || error.message || error).toUpperCase()

            let userMessage = apiConfig.errors[errorCode]
            if (userMessage) {
                val.message = userMessage
                val.code = errorCode
                val.error = errorCode
            }
        } else if (error) {
            if (typeof error === 'string') {
                val.error = error
            } else {
                val.message = error.message
                val.code = error.code
                val.error = val.code
            }
        }

        log.error(message || 'failed', val)
        log.end()
        res.json(val)
    }
    res.data = (item, message, code) => {
        let val = {
            isSuccess: true,
            message: message,
            data: item,
            code: code
        }
        log.silly(message || 'success', val)
        log.end()

        if (item.timeStamp) {
            res.set('Last-Modified', moment(item.timeStamp).toISOString())
        }

        res.json(val)
    }
    res.page = (items, pageSize, pageNo, total) => {
        let val = {
            isSuccess: true,
            pageNo: pageNo || 1,
            items: items,
            pageSize: pageSize || items.length,
            count: total,
            total: total || items.length || pageSize, // TODO: obsolete
            totalRecords: total // TODO: obsolete
        }

        log.silly('page', val)
        log.end()
        res.json(val)
    }
}

const getContext = async (req, log, builder) => {
    let claims = claimsParser.parse(req, log)

    const context = builder ? await builder(claims, log) : claims

    context.permissions = context.permissions || []

    context.config = context.config || {
        timeZone: 'IST'
    }
    if (context.role) {
        if (context.organization) {
            context.permissions.push('organization.user')
        }

        if (context.tenant) {
            context.permissions.push('tenant.user')
        }
    } else {
        if (context.organization) {
            context.permissions.push('organization.guest')
        }

        if (context.tenant) {
            context.permissions.push('tenant.guest')
        }
    }

    if (!context.hasPermission) {
        context.hasPermission = (request) => {
            if (!request) {
                return true
            }

            let items = Array.isArray(request) ? request : [request]

            return context.permissions.find(permission => {
                return items.find(item => item.toLowerCase() === permission)
            })
        }
    }

    if (!context.getConfig) {
        context.getConfig = (identifier, defaultValue) => {
            var keys = identifier.split('.')
            var value = context.config

            for (var key of keys) {
                if (!value[key]) {
                    return defaultValue
                }
                value = value[key]
            }

            return value
        }
    }

    return context
}
exports.getMiddleware = (apiOptions) => {
    let builder

    if (apiOptions && apiOptions.context && apiOptions.context.builder) {
        builder = apiOptions.context.builder
    } else if (apiConfig && apiConfig.context && apiConfig.context.builder) {
        builder = require(`${appRoot}/${apiConfig.context.builder}`).create
    }

    return (req, res, next) => {
        const log = logger.start({ location: req.method + ' ' + req.url, method: req.method, url: req.url })
        res.log = log
        res.logger = log

        if (req.body) {
            log.debug(req.body)
        }

        getContext(req, log, builder).then(context => {
            req.context = context
            decorateResponse(res, log)
            next()
        }).catch(err => {
            let error = err
            let message = err.message
            if ('errors' in apiConfig) {
                error = 'UNKOWN'
                message = 'Internal Server Error'
            }
            res.json({
                isSuccess: false,
                message: message,
                error: error,
                code: 'UNKNOWN'
            })
        })
    }
}
