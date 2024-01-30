const redis = require('redis')

let options = {
    port: 6379,
    host: '127.0.0.1',
    options: {
        'maxmemory-policy': 'allkeys-lru',
        maxmemory: '1gb',
        enable_offline_queue: false
    }
}

const setOptions = (config) => {
    if (config.port) {
        options.port = config.port
    }

    if (config.host) {
        options.host = config.host
    }

    if (config.options) {
        if (config['maxmemory-policy']) {
            options.options['maxmemory-policy'] = config.options.maxmemoryPolicy
        }

        if (config.maxmemory) {
            options.options.maxmemory = config.options.maxmemory
        }
        if (config.password) {
            options.options.password = config.options.password
        }
    }
}

exports.connect = (config) => {
    setOptions(JSON.parse(JSON.stringify(config)) || {})
    const client = redis.createClient(options.port, options.host, options.options)
    return {
        set: async (key, value, ttl) => {
            await client.set(key, JSON.stringify(value))
            await client.expire(key, ttl)
        },
        remove: async (key) => {
            return new Promise((resolve, reject) => {
                client.keys(key, async (err, keys) => {
                    if (!err) {
                        for (let key of keys) {
                            await client.del(key)
                        }
                        resolve()
                    } else {
                        reject(err)
                    }
                })
            })
        },
        get: async (key) => {
            return new Promise((resolve, reject) => {
                client.get(key, function (err, reply) {
                    if (err) {
                        reject(err)
                    }
                    resolve(JSON.parse(reply))
                })
            })
        }
    }
}
