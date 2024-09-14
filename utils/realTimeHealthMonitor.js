const os = require('os-utils');
const readline = require('readline');
const config = require('../config.json');

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
        console.log('----------------------------------');
      });
    });
  }, 3000);
}

let serverConnections = config.servers.map(server => ({
  ...server,
  connections: 0,
  isLimited: false,
  lastLimitedTime: null,
  isDown: false,
  isUnderLoad: false
}));

realTimeHealthMonitor(serverConnections);
