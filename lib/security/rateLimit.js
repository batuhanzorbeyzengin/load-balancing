const config = require('../../config/config.json');
const logger = require('../utils/logService');

let ipRequestCounts = {};
let blockedIPs = new Map();

const BAN_DURATIONS = [
  5 * 60 * 1000,    // 5 minutes
  30 * 60 * 1000,   // 30 minutes
  24 * 60 * 60 * 1000 // 1 day
];

function isIPRateLimited(ip) {
  const currentTime = Date.now();

  if (config.loadBalancer.enableIpBan && blockedIPs.has(ip)) {
    const banInfo = blockedIPs.get(ip);
    if (currentTime < banInfo.unbanTime) {
      return true;
    } else {
      blockedIPs.delete(ip);
    }
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
  if (!config.loadBalancer.enableIpBan) {
    logger.warn(`IP ban is disabled. IP ${ip} would have been banned.`);
    return;
  }

  const currentTime = Date.now();
  let banInfo = blockedIPs.get(ip) || { banCount: 0, unbanTime: 0 };

  banInfo.banCount++;
  const banDurationIndex = Math.min(banInfo.banCount - 1, BAN_DURATIONS.length - 1);
  const banDuration = BAN_DURATIONS[banDurationIndex];
  
  banInfo.unbanTime = currentTime + banDuration;
  blockedIPs.set(ip, banInfo);

  logger.warn(`Blocking IP: ${ip} for ${banDuration / 60000} minutes. Ban count: ${banInfo.banCount}`);
}

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

function cleanupRateLimitData() {
  const currentTime = Date.now();
  const expirationTime = config.loadBalancer.rateLimitWindow * 2;

  for (const ip in ipRequestCounts) {
    if (currentTime - ipRequestCounts[ip].startTime > expirationTime) {
      delete ipRequestCounts[ip];
    }
  }

  for (const port in serverRequestCounts) {
    if (currentTime - serverRequestCounts[port].startTime > expirationTime) {
      delete serverRequestCounts[port];
    }
  }

  for (const [ip, banInfo] of blockedIPs) {
    if (currentTime > banInfo.unbanTime) {
      blockedIPs.delete(ip);
      logger.info(`Ban lifted for IP: ${ip}`);
    }
  }
}

setInterval(cleanupRateLimitData, 3600000);

module.exports = { 
  isIPRateLimited, 
  blockIP, 
  isServerRateLimitExceeded, 
  resetServerRateLimit 
};