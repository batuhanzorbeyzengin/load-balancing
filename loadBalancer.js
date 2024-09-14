const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config.json');
const handleRequest = require('./routes/handleRequest');
const { monitorServerHealth } = require('./utils/healthCheck');
const { monitorServerPerformance } = require('./utils/performanceMonitor');
const { isRegionBlocked } = require('./utils/geoIPCheck');
const { isIPRateLimited, blockIP } = require('./utils/ipRateLimit');
const { getAvailableServer, markServerAsLimited } = require('./utils/loadBalancerUtils');
const { isRateLimitExceeded, resetRateLimit } = require('./utils/rateLimit');
const logger = require('./utils/logService');

let serverConnections = config.servers.map(server => ({
  ...server,
  connections: 0,
  isLimited: false,
  lastLimitedTime: null,
  isDown: false,
  isUnderLoad: false
}));

let requestQueue = [];
const RATE_LIMIT_RECOVERY_TIME = 10000;

const sslOptions = config.loadBalancer.useSSL ? {
  key: fs.readFileSync(config.ssl.keyPath),
  cert: fs.readFileSync(config.ssl.certPath)
} : null;

function enqueueRequest(req, res) {
  logger.warn('No servers available, adding request to queue.');
  requestQueue.push({ req, res });
}

function processQueue() {
  while (requestQueue.length > 0) {
    const { req, res } = requestQueue.shift();
    const targetServer = getAvailableServer(serverConnections);

    if (targetServer) {
      handleRequest(req, res, targetServer)
        .then(() => {
          targetServer.connections--;
          logger.info(`Request to ${targetServer.host}:${targetServer.port} completed successfully (from queue).`);
        })
        .catch(err => {
          targetServer.connections--;
          logger.error(`Error handling request to ${targetServer.host}:${targetServer.port}: ${err.message}`);
          res.writeHead(500);
          res.end('Internal Server Error');
        });
    } else {
      requestQueue.unshift({ req, res });
      break;
    }
  }
}

function onRequest(req, res) {
  const clientIP = req.connection.remoteAddress || req.headers['x-forwarded-for'];

  if (isRegionBlocked(clientIP)) {
    logger.warn(`Request from blocked region (${clientIP}) denied.`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  if (isIPRateLimited(clientIP)) {
    blockIP(clientIP);
    res.writeHead(429, { 'Content-Type': 'text/plain' });
    return res.end('Too Many Requests');
  }

  let targetServer = getAvailableServer(serverConnections);

  if (!targetServer) {
    enqueueRequest(req, res);
    return;
  }

  if (isRateLimitExceeded(targetServer)) {
    markServerAsLimited(targetServer);
    targetServer = getAvailableServer(serverConnections);
    
    if (!targetServer) {
      enqueueRequest(req, res);
      return;
    }
  }

  handleRequest(req, res, targetServer)
    .then(() => {
      targetServer.connections--;
      logger.info(`Request to ${targetServer.host}:${targetServer.port} completed successfully.`);
    })
    .catch(err => {
      targetServer.connections--;
      logger.error(`Error handling request to ${targetServer.host}:${targetServer.port}: ${err.message}`);
      res.writeHead(500);
      res.end('Internal Server Error');
    });
}

setInterval(() => {
  monitorServerHealth(serverConnections);
  monitorServerPerformance(serverConnections);
  processQueue();
}, config.loadBalancer.healthCheckInterval);

if (config.loadBalancer.useSSL) {
  const server = https.createServer(sslOptions, onRequest);
  server.listen(config.loadBalancer.port, () => {
    logger.info(`HTTPS Load balancer running on port ${config.loadBalancer.port}`);
  });
} else {
  const server = http.createServer(onRequest);
  server.listen(config.loadBalancer.port, () => {
    logger.info(`HTTP Load balancer running on port ${config.loadBalancer.port}`);
  });
}
