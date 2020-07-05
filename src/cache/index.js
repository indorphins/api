const redis = require('redis');

let redisClient;

async function init() {
  try {
    redisClient = redis.createClient({
      port: process.env.REDIS_PORT,
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASSWORD
    });
  } catch (err) {
    throw err;
  }

  redisClient.on('error', function (error) {
    throw error;
  });
}

async function get(key) {
  return new Promise((done, reject) => {
    redisClient.get(key, function (err, reply) {
      if (err) return reject(err);
      done(reply);
    });
  })
}

async function set(key, obj, ttl) {
  return new Promise((done, reject) => {
    redisClient.set(key, obj, function (error) {
      if (error) return reject(err)
      if (ttl) redisClient.expire(key, ttl);
      done();
    });
  })
}

module.exports = {
  client: redisClient,
  init,
  get,
  set,
}