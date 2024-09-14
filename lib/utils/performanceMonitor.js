const os = require('os-utils');
const logger = require('./logService');
const readline = require('readline');
const config = require('../../config/config.json');

function monitorServerPerformance(servers) {
  servers.forEach(server => {
    os.cpuUsage((cpuUsage) => {
      const memoryUsage = 1 - os.freememPercentage(); 

      if (cpuUsage > 0.8 || memoryUsage > 0.8) {
        server.isUnderLoad = true;
        logger.warn(`Server ${server.host}:${server.port} is experiencing high load (CPU: ${(cpuUsage * 100).toFixed(2)}%, RAM: ${(memoryUsage * 100).toFixed(2)}%)`);
      } else {
        server.isUnderLoad = false;
      }
    });
  });
}

function clearConsole() {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

function realTimeHealthMonitor(servers) {
  setInterval(() => {
    clearConsole(); 
    console.log('Real-Time Server Health Monitoring');
    console.log('----------------------------------');

    servers.forEach((server, index) => {
      os.cpuUsage((cpuUsage) => {
        const memoryUsage = 1 - os.freememPercentage();
        const status = server.isDown ? 'Offline' : (server.isUnderLoad ? 'Under Load' : 'Healthy');

        console.log(`Server ${index + 1}: ${server.host}:${server.port}`);
        console.log(`Status: ${status}`);
        console.log(`CPU Usage: ${(cpuUsage * 100).toFixed(2)}%`);
        console.log(`Memory Usage: ${(memoryUsage * 100).toFixed(2)}%`);
        console.log(`Active Connections: ${server.connections}`);
        console.log('----------------------------------');
      });
    });
  }, 3000);
}

function initializeServerConnections() {
  return config.servers.map(server => ({
    ...server,
    connections: 0,
    isLimited: false,
    lastLimitedTime: null,
    isDown: false,
    isUnderLoad: false
  }));
}

// Function to update server connections
function updateServerConnections(server, delta) {
  server.connections += delta;
  if (server.connections < 0) server.connections = 0;
}

// Function to get overall load balancer stats
function getLoadBalancerStats(servers) {
  const totalConnections = servers.reduce((sum, server) => sum + server.connections, 0);
  const activeServers = servers.filter(server => !server.isDown).length;
  const serversUnderLoad = servers.filter(server => server.isUnderLoad).length;

  return {
    totalConnections,
    activeServers,
    serversUnderLoad
  };
}

// Function to log periodic health reports
function logPeriodicHealthReport(servers) {
  setInterval(() => {
    const stats = getLoadBalancerStats(servers);
    logger.info(`Load Balancer Health Report:
    Total Active Connections: ${stats.totalConnections}
    Active Servers: ${stats.activeServers}/${servers.length}
    Servers Under High Load: ${stats.serversUnderLoad}`);
  }, config.loadBalancer.healthReportInterval || 300000); // Default to every 5 minutes if not specified
}

module.exports = {
  monitorServerPerformance,
  realTimeHealthMonitor,
  initializeServerConnections,
  updateServerConnections,
  getLoadBalancerStats,
  logPeriodicHealthReport
};