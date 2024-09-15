const config = require('../../config/config.json');
const logger = require('../utils/logService');
const { createHash } = require('crypto');

const SUPPORTED_ALGORITHMS = [
  'roundRobin',
  'weightedRoundRobin',
  'leastConnections',
  'ipHash',
  'consistentHashing',
  'dynamicWeighted',
  'leastResponseTime',
  'urlHash'
];

const DEFAULT_ALGORITHM = 'roundRobin';

class LoadBalancer {
  constructor() {
    this.servers = [];
    this.currentRoundRobinIndex = 0;
    this.algorithm = this.validateAlgorithm(config.loadBalancer.algorithm);
    this.consistentHashRing = new Map();
    this.virtualNodes = 100; // For consistent hashing
  }

  validateAlgorithm(configAlgorithm) {
    if (!configAlgorithm) {
      logger.info(`No algorithm specified in config. Using default: ${DEFAULT_ALGORITHM}`);
      return DEFAULT_ALGORITHM;
    }
    
    if (!SUPPORTED_ALGORITHMS.includes(configAlgorithm)) {
      logger.warn(`Unsupported algorithm: ${configAlgorithm}. Falling back to ${DEFAULT_ALGORITHM}`);
      return DEFAULT_ALGORITHM;
    }
    
    return configAlgorithm;
  }

  initialize(servers) {
    this.servers = servers;
    if (this.algorithm === 'consistentHashing') {
      this.buildConsistentHashRing();
    }
    logger.info(`Load balancer initialized with ${this.algorithm} algorithm`);
  }

  getServer(clientIP, headers = {}) {
    const availableServers = this.getAvailableServers();

    if (availableServers.length === 0) {
      logger.error('No available servers');
      throw new Error('No available servers');
    }

    try {
      switch (this.algorithm) {
        case 'roundRobin':
          return this.getRoundRobinServer(availableServers);
        case 'weightedRoundRobin':
          return this.getWeightedRoundRobinServer(availableServers);
        case 'leastConnections':
          return this.getLeastConnectionsServer(availableServers);
        case 'ipHash':
          return this.getIPHashServer(availableServers, clientIP);
        case 'consistentHashing':
          return this.getConsistentHashServer(clientIP);
        case 'dynamicWeighted':
          return this.getDynamicWeightedServer(availableServers);
        case 'leastResponseTime':
          return this.getLeastResponseTimeServer(availableServers);
        case 'urlHash':
          return this.getURLHashServer(availableServers, headers['host'], headers['url']);
        default:
          logger.warn(`Unknown load balancing algorithm: ${this.algorithm}. Falling back to round robin.`);
          return this.getRoundRobinServer(availableServers);
      }
    } catch (error) {
      logger.error(`Error in getServer: ${error.message}`);
      return this.getFallbackServer(availableServers);
    }
  }

  getAvailableServers() {
    return this.servers.filter(server => !server.isLimited && !server.isDown && !server.isUnderLoad);
  }

  getRoundRobinServer(servers) {
    const server = servers[this.currentRoundRobinIndex];
    this.currentRoundRobinIndex = (this.currentRoundRobinIndex + 1) % servers.length;
    return server;
  }

  getWeightedRoundRobinServer(servers) {
    const totalWeight = servers.reduce((sum, server) => sum + (server.weight || 1), 0);
    let randomWeight = Math.random() * totalWeight;
    
    for (const server of servers) {
      if (randomWeight < (server.weight || 1)) {
        return server;
      }
      randomWeight -= (server.weight || 1);
    }

    return servers[0];
  }

  getLeastConnectionsServer(servers) {
    return servers.reduce((min, server) => 
      (server.connections || 0) < (min.connections || 0) ? server : min
    );
  }

  getIPHashServer(servers, clientIP) {
    const hash = this.hash(clientIP);
    return servers[hash % servers.length];
  }

  getConsistentHashServer(clientIP) {
    const hash = this.hash(clientIP);
    for (let i = 0; i < 0xffffffff; i++) {
      const key = (hash + i) % 0xffffffff;
      if (this.consistentHashRing.has(key)) {
        return this.consistentHashRing.get(key);
      }
    }
    throw new Error('Unable to find server in consistent hash ring');
  }

  getDynamicWeightedServer(servers) {
    const totalLoad = servers.reduce((sum, server) => sum + (server.currentLoad || 0), 0);
    const weights = servers.map(server => 1 - ((server.currentLoad || 0) / totalLoad));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < servers.length; i++) {
      if (random < weights[i]) {
        return servers[i];
      }
      random -= weights[i];
    }

    return servers[0];
  }

  getLeastResponseTimeServer(servers) {
    return servers.reduce((min, server) => 
      (server.averageResponseTime || 0) < (min.averageResponseTime || 0) ? server : min
    );
  }

  getURLHashServer(servers, host, url) {
    const hash = this.hash(`${host}${url}`);
    return servers[hash % servers.length];
  }

  getFallbackServer(servers) {
    logger.warn('Using fallback server selection method');
    return this.getRoundRobinServer(servers);
  }

  hash(key) {
    return createHash('md5').update(key).digest('hex')
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  buildConsistentHashRing() {
    this.consistentHashRing.clear();
    for (const server of this.servers) {
      for (let i = 0; i < this.virtualNodes; i++) {
        const key = this.hash(`${server.host}:${server.port}-${i}`);
        this.consistentHashRing.set(key, server);
      }
    }
  }

  updateServerLoad(server, cpuUsage, memoryUsage) {
    server.currentLoad = (cpuUsage + memoryUsage) / 2;
    logger.debug(`Updated load for server ${server.host}:${server.port}: ${server.currentLoad}`);
  }

  updateServerResponseTime(server, responseTime) {
    if (!server.averageResponseTime) {
      server.averageResponseTime = responseTime;
    } else {
      server.averageResponseTime = 0.7 * server.averageResponseTime + 0.3 * responseTime;
    }
    logger.debug(`Updated average response time for server ${server.host}:${server.port}: ${server.averageResponseTime}ms`);
  }

  markServerAsLimited(server) {
    server.isLimited = true;
    server.lastLimitedTime = Date.now();
    logger.warn(`Server ${server.host}:${server.port} marked as rate limited.`);
  }

  resetServerLimit(server) {
    server.isLimited = false;
    logger.info(`Rate limit reset for server ${server.host}:${server.port}`);
  }
}

module.exports = new LoadBalancer();