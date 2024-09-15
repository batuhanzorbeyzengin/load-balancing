const http = require('http');
const http2 = require('http2');
const https = require('https');
const fs = require('fs');
const url = require('url');
const quiche = require('quiche');
const config = require('../config/config.json');
const handleRequest = require('../routes/handleRequest');
const { monitorServerHealth } = require('../lib/balancer/healthCheck');
const { monitorServerPerformance, initializeServerConnections, updateServerConnections, getLoadBalancerStats, logPeriodicHealthReport } = require('../lib/utils/performanceMonitor');
const { isRegionBlocked } = require('../lib/security/geoIPCheck');
const { isIPRateLimited, blockIP, isServerRateLimitExceeded, resetServerRateLimit } = require('../lib/security/rateLimit');
const loadBalancer = require('../lib/balancer/loadBalancerUtils');
const { isPotentialAttack } = require('../lib/security/ddosProtection');
const { cacheMiddleware } = require('../lib/cache/distributedCache');
const logger = require('../lib/utils/logService');
const { validateConfig } = require('../lib/utils/configValidator');

validateConfig(config);

let serverConnections = initializeServerConnections();
loadBalancer.initialize(serverConnections);

const RATE_LIMIT_RECOVERY_TIME = 10000;

let sslOptions = null;
if (config.loadBalancer.useSSL) {
  try {
    sslOptions = {
      key: fs.readFileSync(config.ssl.keyPath),
      cert: fs.readFileSync(config.ssl.certPath),
      allowHTTP1: true
    };
  } catch (error) {
    logger.error(`Error loading SSL certificates: ${error.message}`);
    process.exit(1);
  }
}

const protocols = ['h2', 'http/1.1'];
if (config.enableHTTP3) {
  protocols.unshift('h3');
}

if (sslOptions) {
  sslOptions.ALPNProtocols = protocols;
}

async function processRequest(req, res) {
  const clientIP = req.socket.remoteAddress;
  const parsedUrl = url.parse(req.url, true);

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

  const targetServer = loadBalancer.getServer(clientIP, {
    host: req.headers.host,
    url: parsedUrl.pathname
  });

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
  
  const startTime = Date.now();

  await cacheMiddleware(req, res, async () => {
    try {
      await handleRequest(req, res, targetServer);
      const responseTime = Date.now() - startTime;
      loadBalancer.updateServerResponseTime(targetServer, responseTime);
      logger.info(`Request to ${targetServer.host}:${targetServer.port} completed in ${responseTime}ms.`);
    } catch (err) {
      logger.error(`Error handling request to ${targetServer.host}:${targetServer.port}: ${err.message}`);
      res.writeHead(500);
      res.end('Internal Server Error');
    } finally {
      updateServerConnections(targetServer, -1);
    }
  });
}

const httpServer = http.createServer(processRequest);

let http2Server = null;
let http3Server = null;

if (sslOptions) {
  http2Server = http2.createSecureServer(sslOptions, processRequest);

  http2Server.on('unknownProtocol', (socket) => {
    httpServer.emit('connection', socket);
  });

  if (config.enableHTTP3) {
    http3Server = quiche.createServer(sslOptions, processRequest);
  }
}

httpServer.listen(config.ports.http, () => {
  logger.info(`HTTP server running on port ${config.ports.http}`);
});

if (http2Server) {
  http2Server.listen(config.ports.https, () => {
    logger.info(`HTTPS and HTTP/2 server running on port ${config.ports.https}`);
  });
}

if (http3Server) {
  http3Server.listen(config.ports.http3, () => {
    logger.info(`HTTP/3 server running on port ${config.ports.http3}`);
  });
}

function updateServerHealth() {
  monitorServerHealth(serverConnections);
  serverConnections.forEach(server => {
    const cpuUsage = server.health ? server.health.cpu / 100 : 0;
    const memoryUsage = server.health ? server.health.memory / 100 : 0;
    loadBalancer.updateServerLoad(server, cpuUsage, memoryUsage);
  });
}

setInterval(updateServerHealth, config.loadBalancer.healthCheckInterval);
setInterval(() => monitorServerPerformance(serverConnections), config.loadBalancer.healthCheckInterval);

logPeriodicHealthReport(serverConnections);

process.on('SIGINT', () => {
  logger.info('Shutting down load balancer...');
  httpServer.close();
  if (http2Server) {
    http2Server.close();
  }
  if (http3Server) {
    http3Server.close();
  }
  logger.info('Load balancer has been shut down');
  process.exit(0);
});