const cache = require("../providers/cache/redis")

exports.extend = item => {
    item.cache = item.cache || {}
    let k = item

    item.cache.get = (key) => {
        if (key === 'request') {
            return cache.get(`${item.service}:${item.url}`)
        }
        return cache.get(key)
    }
    item.cache.remove = async (key, isPattern) => {
        if (key === 'request') {
            let k = await cache.remove(`${item.service}:${item.url}`)
            return k
        }
        return cache.remove(key,isPattern)

    }
    item.cache.set = (key, value) => {
        if (key === 'request') {
            return cache.set(`${item.service}:${item.url}`, value)
        }
        return cache.set(key, value)

    }

    // return from cache - GET
    // if available in cache, 
    // then return from cache

    // else call the request
    // save in cache


    // remove from cache - DELETE, PUT

}