const os = require('os-utils');
const logger = require('./logService');

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

module.exports = { monitorServerPerformance };
