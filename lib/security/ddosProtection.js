const redis = require('redis');
const config = require('../../config/config.json');
const logger = require('../utils/logService');

let client;

async function initRedisClient() {
  client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error('Redis connection retry limit exceeded');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  client.on('error', (err) => {
    logger.error(`Redis Client Error: ${err}`);
  });

  client.on('connect', () => {
    logger.info('Connected to Redis server');
  });

  try {
    await client.connect();
  } catch (err) {
    logger.error(`Failed to connect to Redis: ${err}`);
  }
}

initRedisClient();

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_WINDOW_REQUEST_COUNT = config.loadBalancer.ddosThreshold || 100;
const WINDOW_LOG_INTERVAL_IN_SECONDS = 1;

const blockedUserAgents = [
  'curl',
  'wget',
  'python-requests',
  'PostmanRuntime'
];

async function isPotentialAttack(clientIP, req) {
  const currentTime = Date.now();
  const key = `${clientIP}:${Math.floor(currentTime / 1000)}`;

  const userAgent = req.headers['user-agent'] || '';
  if (blockedUserAgents.some(ua => userAgent.toLowerCase().includes(ua.toLowerCase()))) {
    logger.warn(`Blocked request from bot-like User-Agent: ${userAgent} (IP: ${clientIP})`);
    return true;
  }

  try {
    const requestCount = await client.incr(key);
    await client.expire(key, WINDOW_SIZE_IN_SECONDS);

    if (requestCount > MAX_WINDOW_REQUEST_COUNT) {
      logger.warn(`Possible DDoS attack from IP: ${clientIP}. Requests in last minute: ${requestCount}`);
      return true;
    }

    // Analyze the pattern of requests
    const pattern = await analyzeRequestPattern(clientIP);
    if (pattern.isAnomalous) {
      logger.warn(`Anomalous behavior detected from IP: ${clientIP}`);
      return true;
    }

  } catch (err) {
    logger.error(`Error in DDoS protection: ${err}`);
  }

  return false;
}

async function analyzeRequestPattern(ip) {
  const key = `${ip}:pattern`;
  let pattern;
  
  try {
    pattern = await client.get(key);
  } catch (err) {
    logger.error(`Error getting pattern from Redis: ${err}`);
    return { isAnomalous: false };
  }
  
  if (!pattern) {
    await client.set(key, JSON.stringify({ count: 1, lastRequest: Date.now() }), {
      EX: 3600
    });
    return { isAnomalous: false };
  }

  const { count, lastRequest } = JSON.parse(pattern);
  const now = Date.now();
  const timeDiff = now - lastRequest;

  await client.set(key, JSON.stringify({ count: count + 1, lastRequest: now }), {
    EX: 3600
  });

  // This is a simple heuristic. You might want to use more sophisticated methods.
  if (count > 1000 && timeDiff < 1000) {
    return { isAnomalous: true };
  }

  return { isAnomalous: false };
}

// Helper function to check if an IP is in CIDR range
function isIPInRange(ip, cidr) {
  const [range, bits = 32] = cidr.split('/');
  const mask = ~(2 ** (32 - bits) - 1);
  const ipInt = ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
  const rangeInt = range.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

// Function to check if the IP is from a known proxy or VPN
async function isProxy(ip) {
  // This would typically involve checking against a database or API of known proxy/VPN IPs
  // For simplicity, we'll just check against a small list of example ranges
  const proxyRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
  return proxyRanges.some(range => isIPInRange(ip, range));
}

module.exports = { isPotentialAttack };