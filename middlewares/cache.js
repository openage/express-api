const pathExists = require('path-exists')
const appRoot = require('app-root-path')



exports.getMiddlware = function (apiName, action) {

    return function (req, res, next) {
        // 

        let cache = context.cache;

        // GET - cache,


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
