const http = require('http');
const http2 = require('http2');
const https = require('https');
const quiche = require('quiche');
const fs = require('fs');
const config = require('../config/config.json');
const handleRequest = require('../routes/handleRequest');
const { monitorServerHealth } = require('../lib/balancer/healthCheck');
const { monitorServerPerformance, initializeServerConnections, updateServerConnections, getLoadBalancerStats, logPeriodicHealthReport } = require('../lib/utils/performanceMonitor');
const { isRegionBlocked } = require('../lib/security/geoIPCheck');
const { isIPRateLimited, blockIP, isServerRateLimitExceeded, resetServerRateLimit } = require('../lib/security/rateLimit');
const { getAvailableServer } = require('../lib/balancer/loadBalancerUtils');
const { isPotentialAttack } = require('../lib/security/ddosProtection');
const { cacheMiddleware } = require('../lib/cache/distributedCache');
const logger = require('../lib/utils/logService');
const { validateConfig } = require('../lib/utils/configValidator');

validateConfig(config);

let serverConnections = initializeServerConnections();

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
  
  await cacheMiddleware(req, res, async () => {
    try {
      await forwardRequest(targetServer, req, res);
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

function forwardRequest(server, req, res) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: server.host.replace(/^https?:\/\//, ''),
      port: server.port,
      path: req.url,
      method: req.method,
      headers: req.headers
    };

    let proxyReq;
    if (req.httpVersion === '2.0') {
      proxyReq = http2.request(options);
    } else if (req.httpVersion === '3.0') {
      proxyReq = quiche.request(options);
    } else {
      proxyReq = (server.host.startsWith('https') ? https : http).request(options);
    }

    proxyReq.on('response', (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
    });

    proxyReq.on('error', (error) => {
      logger.error(`Error forwarding request to ${server.host}:${server.port}: ${error.message}`);
      reject(error);
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
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

setInterval(() => {
  monitorServerHealth(serverConnections);
  monitorServerPerformance(serverConnections);
}, config.loadBalancer.healthCheckInterval);

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