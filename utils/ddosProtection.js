const config = require('../config.json');
const logger = require('./logService');

let requestTimestamps = {};

const blockedUserAgents = [
  'curl',
  'wget',
  'python-requests',
  'PostmanRuntime'
];

function isPotentialAttack(clientIP, req) {
  const currentTime = Date.now();

  const userAgent = req.headers['user-agent'] || '';
  if (blockedUserAgents.some(ua => userAgent.toLowerCase().includes(ua.toLowerCase()))) {
    logger.warn(`Blocked request from bot-like User-Agent: ${userAgent} (IP: ${clientIP})`);
    return true;
  }

  if (!requestTimestamps[clientIP]) {
    requestTimestamps[clientIP] = [];
  }

  requestTimestamps[clientIP] = requestTimestamps[clientIP].filter(timestamp => currentTime - timestamp < 10000);

  requestTimestamps[clientIP].push(currentTime);

  if (requestTimestamps[clientIP].length > config.loadBalancer.ddosThreshold) {
    logger.warn(`DDoS-like behavior detected from IP: ${clientIP}. Requests in last 10 seconds: ${requestTimestamps[clientIP].length}`);
    return true;
  }

  return false;
}

module.exports = { isPotentialAttack };
