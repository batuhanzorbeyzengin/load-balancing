const redis = require('redis');
const config = require('../../config/config.json');
const logger = require('../utils/logService');
const geoip = require('geoip-lite');

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

const suspiciousPatterns = [
  /(?:"|'|`|\(|\)|\{|\}|\[|\]|\\|\/)/,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c/i,
  /etc\/passwd|\/etc\/shadow|\beval\b|\bexec\b/i,
];

async function isPotentialAttack(clientIP, req) {
  const currentTime = Date.now();
  const key = `${clientIP}:${Math.floor(currentTime / 1000)}`;

  const userAgent = req.headers['user-agent'] || '';
  if (blockedUserAgents.some(ua => userAgent.toLowerCase().includes(ua.toLowerCase()))) {
    logger.warn(`Blocked request from bot-like User-Agent: ${userAgent} (IP: ${clientIP})`);
    return true;
  }

  const url = req.url;
  const headers = JSON.stringify(req.headers);
  if (suspiciousPatterns.some(pattern => pattern.test(url) || pattern.test(headers))) {
    logger.warn(`Suspicious pattern detected in request from IP: ${clientIP}`);
    return true;
  }

  try {
    const requestCount = await client.incr(key);
    await client.expire(key, WINDOW_SIZE_IN_SECONDS);

    if (requestCount > MAX_WINDOW_REQUEST_COUNT) {
      logger.warn(`Possible DDoS attack from IP: ${clientIP}. Requests in last minute: ${requestCount}`);
      return true;
    }

    const pattern = await analyzeRequestPattern(clientIP);
    if (pattern.isAnomalous) {
      logger.warn(`Anomalous behavior detected from IP: ${clientIP}`);
      return true;
    }

    const geoAnomaly = await checkGeographicalAnomaly(clientIP);
    if (geoAnomaly) {
      logger.warn(`Geographical anomaly detected from IP: ${clientIP}`);
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
    await client.set(key, JSON.stringify({ count: 1, lastRequest: Date.now(), intervalCounts: {} }), {
      EX: 3600
    });
    return { isAnomalous: false };
  }

  const patternData = JSON.parse(pattern);
  const { count, lastRequest, intervalCounts } = patternData;
  const now = Date.now();
  const timeDiff = now - lastRequest;

  const interval = Math.floor(timeDiff / 1000);
  intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;

  const values = Object.values(intervalCounts);
  const avg = values.reduce((a, b) => a + b) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);

  await client.set(key, JSON.stringify({ 
    count: count + 1, 
    lastRequest: now, 
    intervalCounts: intervalCounts 
  }), {
    EX: 3600
  });

  if (count > 1000 && timeDiff < 1000) {
    return { isAnomalous: true };
  }

  if (stdDev > 10) { 
    return { isAnomalous: true };
  }

  return { isAnomalous: false };
}

async function checkGeographicalAnomaly(ip) {
  const key = `${ip}:geo`;
  let geoData;

  try {
    geoData = await client.get(key);
  } catch (err) {
    logger.error(`Error getting geo data from Redis: ${err}`);
    return false;
  }

  const currentGeo = geoip.lookup(ip);

  if (!geoData) {
    await client.set(key, JSON.stringify(currentGeo), {
      EX: 86400  // Store for 24 hours
    });
    return false;
  }

  const storedGeo = JSON.parse(geoData);

  // Check if the country has changed
  if (storedGeo.country !== currentGeo.country) {
    logger.warn(`IP ${ip} changed country from ${storedGeo.country} to ${currentGeo.country}`);
    return true;
  }

  // Check if the city has changed significantly (over 500km)
  const distance = getDistance(storedGeo.ll[0], storedGeo.ll[1], currentGeo.ll[0], currentGeo.ll[1]);
  if (distance > 500) {
    logger.warn(`IP ${ip} location changed by ${distance.toFixed(2)}km`);
    return true;
  }

  return false;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

// function isIPInRange(ip, cidr) {
//   const [range, bits = 32] = cidr.split('/');
//   const mask = ~(2 ** (32 - bits) - 1);
//   const ipInt = ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
//   const rangeInt = range.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
//   return (ipInt & mask) === (rangeInt & mask);
// }

// async function isProxy(ip) {
//   const proxyRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
//   return proxyRanges.some(range => isIPInRange(ip, range));
// }

module.exports = { isPotentialAttack };