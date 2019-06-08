
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

exports.parse = (req, logger) => {
    let claims = {
        id: fetch(req, 'context', 'id'),
        session: fetch(req, 'session', 'id'),
        role: fetch(req, 'role', 'key') || fetch(req, 'role', 'id'),
        organization: fetch(req, 'organization', 'code') || fetch(req, 'organization', 'id'),
        tenant: fetch(req, 'tenant', 'code') || fetch(req, 'tenant', 'id')
    }

    logger.silly(claims)

    claims.logger = logger

    return claims
}
