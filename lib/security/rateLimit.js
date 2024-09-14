const config = require('../../config/config.json');
const logger = require('../utils/logService');

// IP-based rate limiting
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

// Server-based rate limiting
let serverRequestCounts = {};

function isServerRateLimitExceeded(server) {
  const currentTime = Date.now();
  
  if (!serverRequestCounts[server.port]) {
    serverRequestCounts[server.port] = { count: 0, startTime: currentTime };
  }

  const timePassed = currentTime - serverRequestCounts[server.port].startTime;

  if (timePassed > config.loadBalancer.rateLimitWindow) {
    serverRequestCounts[server.port] = { count: 1, startTime: currentTime };
    return false;
  }

  serverRequestCounts[server.port].count++;

  return serverRequestCounts[server.port].count > config.loadBalancer.rateLimit;
}

function resetServerRateLimit(server) {
  serverRequestCounts[server.port] = { count: 0, startTime: Date.now() };
}

// Cleanup function to remove old entries
function cleanupRateLimitData() {
  const currentTime = Date.now();
  const expirationTime = config.loadBalancer.rateLimitWindow * 2; // Double the window for safety

  // Cleanup IP-based rate limit data
  for (const ip in ipRequestCounts) {
    if (currentTime - ipRequestCounts[ip].startTime > expirationTime) {
      delete ipRequestCounts[ip];
    }
  }

  // Cleanup server-based rate limit data
  for (const port in serverRequestCounts) {
    if (currentTime - serverRequestCounts[port].startTime > expirationTime) {
      delete serverRequestCounts[port];
    }
  }

  // Optionally, we could also clear old blocked IPs here
  // This depends on your policy for how long IPs should remain blocked
}

// Run cleanup every hour
setInterval(cleanupRateLimitData, 3600000);

module.exports = { 
  isIPRateLimited, 
  blockIP, 
  isServerRateLimitExceeded, 
  resetServerRateLimit 
};