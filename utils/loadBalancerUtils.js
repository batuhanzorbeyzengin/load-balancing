const logger = require('./logService');

function getAvailableServer(serverConnections) {
  const availableServers = serverConnections.filter(server => !server.isLimited && !server.isDown && !server.isUnderLoad);

  if (availableServers.length === 0) return null;

  const weightedServers = [];
  availableServers.forEach(server => {
    for (let i = 0; i < server.weight; i++) {
      weightedServers.push(server);
    }
  });

  const randomIndex = Math.floor(Math.random() * weightedServers.length);
  return weightedServers[randomIndex];
}

function markServerAsLimited(server) {
  server.isLimited = true;
  server.lastLimitedTime = Date.now();
  logger.warn(`Server ${server.host}:${server.port} marked as rate limited.`);
}

module.exports = { getAvailableServer, markServerAsLimited };
