const moment = require('moment')

const auth = require('config').get('auth')
const validations = auth.config.validate || {}

exports.isValid = (data, context) => {
    let req = context.req
    if (validations.ip && data.ip !== req.ip) {
        let error = 'INVALID_DEVICE'
        context.logger.warn(error, { ip: req.ip })
        return error
    }

    if (validations.expiry && moment() > moment(data.expiry)) {
        let error = 'SESSION_EXPIRED'
        context.logger.warn(error, { expiry: req.expiry })
        return error
    }

    if (validations.session && data.session && data.session.status && 'in-active|inactive|expired'.indexOf(data.session.status.toLowerCase()) !== -1) {
        let error = 'SESSION_EXPIRED'
        context.logger.warn(error, { status: data.session.status })
        return error
    }
}
