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

exports.set = async (key, value) => {
    await client.set(key, JSON.stringify(value));
}

exports.remove = async (key, isPattern) => {
    if (isPattern) {
        client.keys(key+'*', (err, keys) => {
            if (err) throw err;

            // delete each key that matches the pattern
            keys.forEach(key => {
                client.del(key, (err, result) => {
                    if (err) throw err;
                    console.log(`Deleted key: ${key}`);
                });
            });
        });
    } else {
        return await client.del(key);
    }
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