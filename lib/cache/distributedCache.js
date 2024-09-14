const Memcached = require('memcached');
const logger = require('../utils/logService');

const memcached = new Memcached(process.env.MEMCACHED_SERVERS || 'localhost:11211', {
  retries: 10,
  retry: 10000,
  remove: true
});

function get(key) {
  return new Promise((resolve, reject) => {
    memcached.get(key, (err, data) => {
      if (err) {
        logger.error(`Memcached get error: ${err}`);
        return reject(err);
      }
      resolve(data);
    });
  });
}

function set(key, value, lifetime = 3600) {
  return new Promise((resolve, reject) => {
    memcached.set(key, value, lifetime, (err) => {
      if (err) {
        logger.error(`Memcached set error: ${err}`);
        return reject(err);
      }
      resolve();
    });
  });
}

function del(key) {
  return new Promise((resolve, reject) => {
    memcached.del(key, (err) => {
      if (err) {
        logger.error(`Memcached delete error: ${err}`);
        return reject(err);
      }
      resolve();
    });
  });
}

async function cacheMiddleware(req, res, next) {
  const key = req.url;
  try {
    const cachedResponse = await get(key);
    if (cachedResponse) {
      res.send(cachedResponse);
      return;
    }

    // Store the original send function
    const originalSend = res.send;

    // Override the send function
    res.send = function(body) {
      set(key, body)
        .then(() => logger.info(`Cached response for ${key}`))
        .catch(err => logger.error(`Error caching response: ${err}`));

      // Call the original send function
      originalSend.call(this, body);
    };

    next();
  } catch (error) {
    logger.error(`Cache middleware error: ${error}`);
    next();
  }
}

module.exports = { get, set, del, cacheMiddleware };