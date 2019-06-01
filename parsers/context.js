
const uuid = require('uuid')
const appRoot = require('app-root-path')

const apiConfig = require('config').api || {}


let builder

if (apiConfig && apiConfig.context && apiConfig.context.builder) {
    builder = require(`${appRoot}/${apiConfig.context.builder}`)
}

const fetch = (req, modelName, paramName) => {
    var value = req.query[`${modelName}-${paramName}`] || req.headers[`x-${modelName}-${paramName}`]
    if (!value && req.body[modelName]) {
        value = req.body[modelName][paramName]
    }
    if (!value) {
        return null
    }

    var model = {}
    model[paramName] = value
    return model
}

exports.parse = async (req, logger) => {
    let log = logger.start('@open-age/api/parser/context')

    let claims = {
        logger: logger,
        id: fetch(req, 'context', 'id') || uuid.v1(),
        session: fetch(req, 'session', 'id'),
        role: fetch(req, 'role', 'key') || fetch(req, 'role', 'id'),
        organization: fetch(req, 'organization', 'code') || fetch(req, 'organization', 'id'),
        tenant: fetch(req, 'tenant', 'code') || fetch(req, 'tenant', 'id')
    }

    const context = builder ? await builder.create(claims) : claims

    context.permissions = context.permissions || []

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

    context.hasPermission = (request) => {
        if (!request) {
            return true
        }

        let items = Array.isArray(request) ? request : [request]

        return context.permissions.find(permission => {
            return items.find(item => item.toLowerCase() === permission)
        })
    }

    log.end()

    return context
}
