let cacheConfig
let cache
try {
    cacheConfig = require('config').get('cache')
    cache = require(`../providers/cache/${cacheConfig.provider}`).connect(cacheConfig)
    throw new Error("HI")
} catch (err) {
    console.error("error while connecting to cache server:-",err)
}

exports.extend = item => {
    item.cache = item.cache || {}
    if (item.cache) {
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