const config = require('../config.json');
const logger = require('./logService');

let ipRequestCounts = {};
let blockedIPs = new Set();

function isIPRateLimited(ip) {
  const currentTime = Date.now();

  if (blockedIPs.has(ip)) {
    return true;
  }

  if (!ipRequestCounts[ip]) {
    ipRequestCounts[ip] = { count: 1, startTime: currentTime };
  } else {
    const timePassed = currentTime - ipRequestCounts[ip].startTime;

    if (timePassed > config.loadBalancer.rateLimitWindow) {
      ipRequestCounts[ip] = { count: 1, startTime: currentTime };
    } else {
      ipRequestCounts[ip].count++;
    }
  }

  return ipRequestCounts[ip].count > config.loadBalancer.ipRateLimit;
}

function blockIP(ip) {
  logger.warn(`Blocking IP: ${ip}`);
  blockedIPs.add(ip);
}

module.exports = { isIPRateLimited, blockIP };
