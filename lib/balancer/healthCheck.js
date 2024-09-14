const http = require('http');
const config = require('../../config/config.json');
const logger = require('../utils/logService');

function checkServerHealth(server) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: server.host.replace('http://', ''),
            port: server.port,
            path: '/health',
            method: 'GET',
            timeout: config.loadBalancer.healthCheckTimeout
        };

        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const healthData = JSON.parse(data);
                        resolve(healthData);
                    } catch (e) {
                        reject(new Error(`Invalid health check response from ${server.host}:${server.port}`));
                    }
                } else {
                    reject(new Error(`Health check failed for ${server.host}:${server.port}`));
                }
            });
        });

        req.on('error', () => reject(new Error(`Unable to reach ${server.host}:${server.port}`)));
        req.on('timeout', () => reject(new Error(`Health check timed out for ${server.host}:${server.port}`)));
        req.end();
    });
}

function monitorServerHealth(servers) {
    servers.forEach(server => {
        checkServerHealth(server)
            .then(healthData => {
                server.isDown = false;
                server.health = healthData;
                logger.info(`Server ${server.host}:${server.port} is healthy. CPU: ${healthData.cpu}%, Memory: ${healthData.memory}%`);
            })
            .catch(error => {
                server.isDown = true;
                logger.warn(`Server ${server.host}:${server.port} is down: ${error.message}`);
            });
    });
}

module.exports = { monitorServerHealth };