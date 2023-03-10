const redis = require("redis")
const client = redis.createClient({
    "host": 'localhost',
    "port": 6379,
    "maxmemory": '1gb',
    "maxmemory-policy": 'allkeys-lru'
})

client.on('connect', err => {
    if (err) {
        console.log("error while connecting to redis cache: -", err)
    } else {
        console.log("Connected to Redis Cache")
    }
});

exports.set = async (key, value, ttl) => {
    await client.set(key, JSON.stringify(value))
    await client.expire(key, ttl)
}

exports.remove = async (key) => {
    return new Promise((resolve, reject) => {
        client.keys(key, (err, keys) => {
            if (err) reject(err);
            keys.forEach(key => {
                client.del(key, (err, result) => {
                    if (err) reject(err);
                    console.log(`Deleted key: ${key}`);
                });
            });
        });
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