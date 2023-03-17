let cacheConfig
let cache
try {
    cacheConfig = require('config').get('cacheServer')
    cache = require(cacheConfig.type).connect(cacheConfig.config)
} catch (err) {
    if (!cacheConfig) {
        console.info("To enable cache configure 'cacheServer' property")
    } else {
        console.error("could not connect to cache server:-", err)
    }
}

const getErrorMsg = (cacheConfig, err) => {
    console.error(err)
    let msg = "To enable cache configure 'cacheServer' property"
    if (cacheConfig) {
        msg = `Error from ${cacheConfig.provider}: ${err}`
    }
    return msg
}
exports.extend = item => {
    item.cache = item.cache || {}
    item.cache.get = async (key, getter) => {
        try {
            let value = await cache.get(key)

            if (!value && getter) {
                value = await getter()
                await item.cache.set(key, value)
            }

            return value
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }

    }

    item.cache.remove = async (key) => {
        try {
            return await cache.remove(key)
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }
    }
    item.cache.add = async (key, value, ttl = 5 * 60) => {
        try {
            return await cache.set(key, value, ttl)
        } catch (err) {
            throw new Error(getErrorMsg(cacheConfig, err))
        }
    }
}