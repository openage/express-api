exports.extend = item => {
    item.cache = item.cache || {}

    item.cache.get = (key) => {
        if (key === 'request') {
        }

    }
    item.cache.remove = (key) => {
        if (key === 'request') {
        }

    }
    item.cache.set = (key, value) => {
        if (key === 'request') {
        }

    }

    // return from cache - GET
    // if available in cache, 
    // then return from cache

    // else call the request
    // save in cache


    // remove from cache - DELETE, PUT

}