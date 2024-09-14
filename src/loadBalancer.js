const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('../config/config.json');
const handleRequest = require('../routes/handleRequest');
const { monitorServerHealth } = require('../lib/balancer/healthCheck');
const { monitorServerPerformance, initializeServerConnections, updateServerConnections, logPeriodicHealthReport } = require('../lib/utils/performanceMonitor');
const { isRegionBlocked } = require('../lib/security/geoIPCheck');
const { isIPRateLimited, blockIP, isServerRateLimitExceeded, resetServerRateLimit } = require('../lib/security/rateLimit');
const { getAvailableServer } = require('../lib/balancer/loadBalancerUtils');
const { isPotentialAttack } = require('../lib/security/ddosProtection');
const { cacheMiddleware } = require('../lib/cache/distributedCache');
const logger = require('../lib/utils/logService');
const { validateConfig } = require('../lib/utils/configValidator');

// Validate configuration
validateConfig(config);

let serverConnections = initializeServerConnections();

const RATE_LIMIT_RECOVERY_TIME = 10000;

const sslOptions = config.loadBalancer.useSSL ? {
  key: fs.readFileSync(config.ssl.keyPath),
  cert: fs.readFileSync(config.ssl.certPath)
} : null;

async function processRequest(req, res) {
  const clientIP = req.socket.remoteAddress;

  if (isRegionBlocked(clientIP)) {
    logger.warn(`Request from blocked region (${clientIP}) denied.`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  if (await isPotentialAttack(clientIP, req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  if (isIPRateLimited(clientIP)) {
    blockIP(clientIP);
    res.writeHead(429, { 'Content-Type': 'text/plain' });
    return res.end('Too Many Requests');
  }

  const targetServer = getAvailableServer(serverConnections);

  if (!targetServer) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    return res.end('Service Unavailable');
  }

  if (isServerRateLimitExceeded(targetServer)) {
    targetServer.isLimited = true;
    setTimeout(() => {
      targetServer.isLimited = false;
      resetServerRateLimit(targetServer);
      logger.info(`Rate limit reset for server ${targetServer.host}:${targetServer.port}`);
    }, RATE_LIMIT_RECOVERY_TIME);
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    return res.end('Service Unavailable');
  }

  updateServerConnections(targetServer, 1);
  
  // Apply caching middleware
  await cacheMiddleware(req, res, async () => {
    try {
      await handleRequest(req, res, targetServer);
      logger.info(`Request to ${targetServer.host}:${targetServer.port} completed successfully.`);
    } catch (err) {
      logger.error(`Error handling request to ${targetServer.host}:${targetServer.port}: ${err.message}`);
      res.writeHead(500);
      res.end('Internal Server Error');
    } finally {
      updateServerConnections(targetServer, -1);
    }
  });
}

const server = config.loadBalancer.useSSL
  ? https.createServer(sslOptions, processRequest)
  : http.createServer(processRequest);

server.listen(config.loadBalancer.port, () => {
  logger.info(`${config.loadBalancer.useSSL ? 'HTTPS' : 'HTTP'} Load balancer running on port ${config.loadBalancer.port}`);
});

setInterval(() => {
  monitorServerHealth(serverConnections);
  monitorServerPerformance(serverConnections);
}, config.loadBalancer.healthCheckInterval);

logPeriodicHealthReport(serverConnections);

process.on('SIGINT', () => {
  logger.info('Shutting down load balancer...');
  server.close(() => {
    logger.info('Load balancer has been shut down');
    process.exit(0);
  });
});