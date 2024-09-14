const config = require('../config.json');

let requestCounts = {};

function isRateLimitExceeded(server) {
  const currentTime = Date.now();
  
  if (!requestCounts[server.port]) {
    requestCounts[server.port] = { count: 0, startTime: currentTime };
  }

  const timePassed = currentTime - requestCounts[server.port].startTime;

  if (timePassed > config.loadBalancer.rateLimitWindow) {
    requestCounts[server.port] = { count: 1, startTime: currentTime };
    return false;
  }

  requestCounts[server.port].count++;

  return requestCounts[server.port].count > config.loadBalancer.rateLimit;
}

function resetRateLimit(server) {
  requestCounts[server.port] = { count: 0, startTime: Date.now() };
}

module.exports = { isRateLimitExceeded, resetRateLimit };
