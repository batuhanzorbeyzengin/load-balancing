const http = require('http');
const config = require('../config.json');
const logger = require('./logService');

function checkServerHealth(server) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: server.host.replace('http://', ''),
            port: server.port,
            path: '/',
            method: 'GET',
            timeout: config.loadBalancer.healthCheckTimeout
        };

        const req = http.request(options, res => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                reject(new Error(`Health check failed for ${server.host}:${server.port}`));
            }
        });

        req.on('error', () => reject(new Error(`Unable to reach ${server.host}:${server.port}`)));
        req.on('timeout', () => reject(new Error(`Health check timed out for ${server.host}:${server.port}`)));
        req.end();
    });
}

function monitorServerHealth(servers) {
    servers.forEach(server => {
        checkServerHealth(server)
            .then(() => {
                if (server.isDown) {
                    server.isDown = false;
                    logger.info(`Server ${server.host}:${server.port} is now healthy and back in rotation.`);
                }
            })
            .catch(() => {
                if (!server.isDown) {
                    server.isDown = true;
                    logger.warn(`Server ${server.host}:${server.port} is down. Removing from rotation.`);
                }
            });
    });
}

module.exports = { monitorServerHealth };
