const crypto = require('crypto')
const moment = require('moment')

const jwt = require('jsonwebtoken')

const auth = JSON.parse(JSON.stringify(require('config').get('auth') || {
    provider: 'directory'
}))

auth.config = auth.config || {}

auth.config.validate = auth.config.validate || {}

const parse = (token) => {
    return jwt.decode(token, auth.config.secret, {
        expiresIn: auth.config.expiresIn || 1440
    })
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

exports.extract = async (req, logger) => {

    let claims = {
        session: fetch(req, 'session', 'id'),
        role: fetch(req, 'role', 'key'),
        organization: fetch(req, 'organization', 'code') || fetch(req, 'organization', 'id'),
        tenant: fetch(req, 'tenant', 'code') || fetch(req, 'tenant', 'id')
    }

    const context = fetch(req, 'context', 'id')
    if (context) {
        claims.id = context.id
    }

    // if token exists overwrite the claims from token

    let access = fetch(req, 'access', 'token') || {}

    let token = req.headers['authorization'] || access.token || req.query['access_token']

    if (!token) {
        return claims
    }

    if (token.startsWith('Bearer ') || token.startsWith('bearer ')) {
        token = token.substr(7)
    }

    let data
    try {
        data = parse(token)
    } catch (error) {
        error = new Error('INVALID_TOKEN')
        error.status = 401
        throw error
    }

    if (auth.config.validate.ip && data.ip !== req.ip) {
        error = new Error('INVALID_DEVICE')
        error.status = 403
        throw error
    }

    if (auth.config.validate.expiry && moment() > moment(data.expiry)) {
        error = new Error('SESSION_EXPIRED')
        error.status = 403
        throw error
    }

    if (!data.contextId) {
        const context = fetch(req, 'context', 'id')

        if (context) {
            data.contextId = context.id
        }
    }

    if (data.type || data.type == "impersonate") {
        claims.impersonating = true
    }

    if (data.contextId) {
        claims.id = data.contextId
    }

    if (data.sessionId) {
        claims.session = {
            id: data.sessionId
        } || fetch(req, 'session', 'id')
    }

    if (data.roleKey || data.key || data.roleId) {
        claims.role = {
            key: data.roleKey || data.key,
            id: data.roleId
        }
    }

    if (data.organizationCode || data.organizationId) {
        claims.organization = {
            code: data.organizationCode,
            id: data.organizationId
        }
    }

    if (data.tenantCode || data.tenantId) {
        claims.tenant = {
            code: data.tenantCode,
            id: data.tenantId
        }
    }

    return claims
}