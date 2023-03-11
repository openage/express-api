var queueConfig = require('config').get('queueServer')
const redis = require("redis")

let options = {
    port: 6379,
    host: '127.0.0.1',
    options: {
        password: 'foobared',
        "maxmemory-policy": 'allkeys-lru',
        maxmemory: '1gb'
    }
}

const setOptions = (config) => {
    if (config.port) {
        options.port = config.port
    }

    if (config.host) {
        options.host = config.host
    }

    if (config['maxmemory-policy']) {
        options.options['maxmemory-policy'] = config['maxmemory-policy']
    }

    if (config.maxmemory) {
        options.options.maxmemory = config.maxmemory
    }
    if (config.password) {
        options.options.password = config.password
    }
}

setOptions(JSON.parse(JSON.stringify(queueConfig)) || {})


const client = redis.createClient(options.port, options.host, options.options)

exports.set = async (key, value, ttl) => {
    await client.set(key, JSON.stringify(value))
    await client.expire(key, ttl)
}

exports.remove = async (key) => {
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
}


exports.get = async (key) => {
    return new Promise((resolve, reject) => {
        client.get(key, function (err, reply) {
            if (err) {
                reject(err)
            }
            resolve(JSON.parse(reply))
        });
    })
}