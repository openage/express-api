const moment = require('moment')
const logger = require('@open-age/logger')()

const apiConfig = require('config').api || {}
const contextParser = require('../parsers/context')

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
        res.status(error.status || 400)
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

exports.middleware = function (req, res, next) {
    const log = logger.start({ location: req.method + ' ' + req.url, method: req.method, url: req.url })
    res.log = log
    res.logger = log

    if (req.body) {
        log.debug(req.body)
    }

    contextParser.parse(req, log).then(context => {
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
