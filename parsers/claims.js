const crypto = require('crypto')
const moment = require('moment')

const authConfig = require('config').get('auth') || {
    provider: 'directory'
}
const options = authConfig.options || {}

const strategy = {
    custom: (req) => {
        const decrypt = (hash) => {
            var decipher = crypto.createDecipher(options.algorithm || 'aes-256-ctr', authConfig.secret)
            return decipher.update(hash, 'hex', 'utf8') + decipher.final('utf8')
        }

        let token = req.headers['authorization']
        if (!token) {
            token = req.query['access_token']
        }

        if (token) {

            if (token.startsWith('Bearer ')) {
                token = token.substr(7)
            }

            let data
            try {
                data = JSON.parse(decrypt(token))
            } catch (error) {
                error = new Error('INVALID_TOKEN')
                error.status = 401
                throw error
            }
            if (data.ip !== req.ip) {
                error = new Error('INVALID_DEVICE')
                error.status = 403
                throw error
            }
            if (moment() > moment(data.expiry)) {
                error = new Error('SESSION_EXPIRED')
                error.status = 403
                throw error
            }

            return {
                role: {
                    key: data.key
                },
                 session:{
                    id:data.session
                }
            }
        }

        return {
            role: fetch(req, 'role', 'key') || fetch(req, 'role', 'id'),
        }
    },
    directory: (req) => {
        return {
            role: fetch(req, 'role', 'key') || fetch(req, 'role', 'id'),
        }
    }

}

const fetch = (req, modelName, paramName) => {
    var value = req.query[`${modelName}-${paramName}`] || req.headers[`x-${modelName}-${paramName}`]
    // if (!value && req.body[modelName]) {
    //     value = req.body[modelName][paramName]
    // }
    if (!value) {
        return null
    }
    var model = {}
    model[paramName] = value
    return model
}
exports.parse = async (req, logger) => {
    const claims = strategy[authConfig.provider](req)

    claims.id = fetch(req, 'context', 'id')
    claims.ip = req.ip
    claims.session = fetch(req, 'session', 'id')
    claims.organization = fetch(req, 'organization', 'code') || fetch(req, 'organization', 'id')
    claims.tenant = fetch(req, 'tenant', 'code') || fetch(req, 'tenant', 'id')

    logger.silly(claims)
    claims.logger = logger
    return claims
}
