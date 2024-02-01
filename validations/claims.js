const errors = require('../helpers/errors')

const auth = require('config').get('auth')
const validations = auth.config.validate || {}

exports.isValid = (data, context) => {
    let req = context.req
    if (validations.ip && data.ip !== req.ip) {
        let error = errors.codes.INVALID_IP
        context.logger.warn(error, { ip: req.ip })
        return error
    }

    if (validations.session && data.session && data.session.status && 'in-active|inactive|expired'.split('|').indexOf(data.session.status.toLowerCase()) !== -1) {
        let error = errors.codes.SESSION_EXPIRED
        context.logger.warn(error, { status: data.session.status })
        return error
    }
}
