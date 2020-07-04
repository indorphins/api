const redis = require('redis');
const log = require('../log');

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

export async function get(key) {
  redisClient.get(key, function (err, reply) {
    if (err) throw err;
    return reply;
  });
}

export async function set(key, obj, ttl) {
  redisClient.set(key, obj, function (error) {
    if (error) {
      throw error;
    }
    if (ttl) redisClient.expire(key, ttl);
    return;
  });
}

module.exports = {
  client: redisClient,
  init: init,
}