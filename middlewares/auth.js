const uuid = require('uuid')
const config = require('config').get('auth')

const parser = require('../parsers/claims')
const validator = require('../validators/claims')

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

    if (provider.sessions && claims.session && claims.session.id) {
        claims.session = await provider.sessions.get(claims.session.id, { logger: logger })
    }

    let errCode = validator.isValid(claims, { req: req, logger: logger })
    if (errCode) {
        let error = new Error(errCode)
        error.status = 403
        throw error
    }

    claims.id = claims.id || uuid.v1()
    claims.ip = req.ip

    logger.silly(claims)
    claims.logger = logger
    return claims
}
