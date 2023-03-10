

exports.extend = item => {
    let provider = item.config.get(`provider.cache`, 'redis')
    const cache = require(`../providers/cache/${provider}`)
    item.cache = item.cache || {}
    let k = item

    item.cache.get = async (key) => {
        return await cache.get(key)
    }
    item.cache.remove = async (key) => {
        return await cache.remove(key)

    }
    item.cache.set = (key, value, ttl = 5 * 60) => {
        return cache.set(key, value, ttl)
    }
}