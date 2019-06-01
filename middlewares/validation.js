const pathExists = require('path-exists')
const appRoot = require('app-root-path')

const apiConfig = require('config').api || {}

apiConfig.validators = apiConfig.validators || {}
apiConfig.validators.dir = apiConfig.validators.dir || 'validators'

exports.getMiddlware = function (apiName, action) {
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
        const logger = req.context.logger.start(`${apiConfig.validators.dir}/${apiName}:${actionValidator}`)

        let handled = false
        let callback = (err) => {
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
