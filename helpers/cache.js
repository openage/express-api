let cacheConfig
let cache
try {
    cacheConfig = require('config').get('cacheServer')
    cache = require(`../providers/cache/${cacheConfig.provider}`).connect(cacheConfig)
} catch (err) {
    if (!cacheConfig) {
        console.info("To enable cache configure 'cacheServer' property")
    } else {
        console.error("could not connect to cache server:-", err)
    }
}

exports.extend = item => {
    item.cache = item.cache || {}
    if (Object.keys(item.cache).length) {
        item.cache.get = async (key, getter) => {
            let value = await cache.get(key)

            if (!value && getter) {
                value = await getter()
                await item.cache.set(key, value)
            }

            return value
        }

        item.cache.remove = async (key) => {
            return await cache.remove(key)
        }
        item.cache.add = async (key, value, ttl = 5 * 60) => {
            return await cache.set(key, value, ttl)
        }
    }
}