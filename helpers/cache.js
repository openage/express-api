let config = require('config')
let cacheConfig
if (config.has('cacheServer')) {
    cacheConfig = config.get('cacheServer')
}
let cache

if (cacheConfig && !cacheConfig.disabled) {
    cache = require(cacheConfig.type).connect(cacheConfig.config)
}

const getErrorMsg = (cacheConfig, err) => {
    console.error(err)
    return `${cacheConfig.provider}: ${err}`
}
exports.extend = item => {
    item.cache = item.cache || {}
    item.cache.get = async (key, getter) => {
        try {
            let value

            if (cache) {
                value = await cache.get(key)
            }

            if (!value && getter) {
                value = await getter()
                if (cache) {
                    await item.cache.set(key, value)
                }
            }

            return value
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }
    }

    item.cache.remove = async (key) => {
        try {
            if (cache) {
                return await cache.remove(key)
            }
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }
    }
    item.cache.add = async (key, value, ttl = 5 * 60) => {
        try {
            if (cache) {
                return await cache.set(key, value, ttl)
            }
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }
    }
}
