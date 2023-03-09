const redis = require("redis")
const client = redis.createClient({
    url: 'redis://localhost:6379'
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

exports.remove = async (key) => {
    return await client.del(key);
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