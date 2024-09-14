const http = require('http');
const config = require('../config/config.json');
const logger = require('../lib/utils/logService');

function handleRequest(req, res, targetServer) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: targetServer.host.replace('http://', ''),
            port: targetServer.port,
            path: req.url,
            method: req.method,
            headers: req.headers
        };

        const proxy = http.request(options, serverRes => {
            res.writeHead(serverRes.statusCode, serverRes.headers);
            serverRes.pipe(res);
            resolve();
        });

        req.pipe(proxy);

        proxy.on('error', err => {
            logger.error(`Error during request to ${targetServer.host}:${targetServer.port}: ${err.message}`);
            reject(err);
        });
    });
}

module.exports = handleRequest;
