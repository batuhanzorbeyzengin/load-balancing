const logger = require('../utils/logService');

function getAvailableServer(serverConnections) {
  const availableServers = serverConnections.filter(server => !server.isLimited && !server.isDown && !server.isUnderLoad);

  if (availableServers.length === 0) return null;

  let totalWeight = availableServers.reduce((sum, server) => sum + server.weight, 0);
  let randomWeight = Math.random() * totalWeight;
  
  for (let server of availableServers) {
    if (randomWeight < server.weight) {
      return server;
    }
    randomWeight -= server.weight;
  }

  return availableServers[0];
}

function markServerAsLimited(server) {
  server.isLimited = true;
  server.lastLimitedTime = Date.now();
  logger.warn(`Server ${server.host}:${server.port} marked as rate limited.`);
}

module.exports = { getAvailableServer, markServerAsLimited };