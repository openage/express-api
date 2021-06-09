const uuid = require('uuid')
const config = require('config').get('auth')

const getProvider = () => {
    let provider = config ? config.provider : 'directory'

    if (!provider || provider === 'directory') {
        provider = './providers/directory'
    }

    return require(provider)
}

const provider = getProvider()

exports.claims = async (req, logger) => {
    const claims = provider.extract(req, logger)

    claims.id = claims.id || uuid.v1()

    claims.ip = req.ip
    logger.silly(claims)
    claims.logger = logger
    return claims
}