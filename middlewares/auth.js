const uuid = require('uuid')
const moment = require('moment')
const config = require('config').get('auth')
const parser = require('../parsers/claims')
const validator = require('../validators/claims')
const errors = require('../helpers/errors')

const getProvider = () => {
    let provider = config ? config.provider : 'directory'

    if (!provider || provider === 'directory') {
        provider = '../providers/directory'
    }

    return require(provider)
}

const provider = getProvider()

exports.claims = async (req, logger) => {
    const claims = await parser.parse(req, logger)

    if (claims.expiry && moment() > moment(claims.expiry)) {
        let error = new Error(errors.codes.CLAIMS_EXPIRED)
        error.status = errors.status.CLAIMS_EXPIRED
        throw error
    }

    if (provider.sessions && claims.session && claims.session.id) {
        claims.session = await provider.sessions.get(claims.session.id, { logger: logger })
    }

    let errCode = validator.isValid(claims, { req: req, logger: logger })
    if (errCode) {
        let error = new Error(errCode)
        error.status = errors.status.INVALID_CLAIMS
        throw error
    }

    claims.id = claims.id || uuid.v1()
    claims.ip = req.ip

    logger.silly(claims)
    claims.logger = logger
    return claims
}
