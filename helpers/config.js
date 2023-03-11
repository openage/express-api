const defaultConfig = require('config')

exports.extend = context => {
    const getValue = (identifier, value) => {
        if (!value) { return }
        for (const key of identifier.split('.')) {
            if (!value[key]) {
                value = null
                break
            }
            value = value[key]
        }

        return value
    }

    return {
        get: (key, defaultValue) => {
            let value = context.organization ? getValue(key, context.organization.config) : null

            if (!value) {
                value = context.tenant ? getValue(key, context.tenant.config) : null
            }

            if (!value && defaultConfig.has(key)) {
                value = defaultConfig.get(key)
            }

            if (!value) {
                value = defaultValue
            }

            if (!value) {
                switch (key) {
                    case 'timeZone':
                        return 'IST'
                }
            }

            return value
        }
    }
}