const http = require('http');
const config = require('../config/config-test.json');
const logger = require('../lib/utils/logService');

const { url, totalRequests, requestIntervalMs } = config.test;

let completedRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalResponseTime = 0;

function sendRequest() {
    const startTime = Date.now();

    const req = http.get(url, res => {
        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;

        if (res.statusCode === 200) {
            successfulRequests++;
            logger.info(`Request succeeded. Response time: ${responseTime}ms`);
        } else {
            failedRequests++;
            logger.warn(`Request failed with status code: ${res.statusCode}. Response time: ${responseTime}ms`);
        }

        completedRequests++;
        if (completedRequests === totalRequests) {
            printTestSummary();
        }
    });

    req.on('error', err => {
        failedRequests++;
        logger.error(`Request error: ${err.message}`);
        completedRequests++;
        if (completedRequests === totalRequests) {
            printTestSummary();
        }
    });
}

function startTest() {
    logger.info(`Starting test with ${totalRequests} requests to ${url}`);
    for (let i = 0; i < totalRequests; i++) {
        setTimeout(sendRequest, i * requestIntervalMs);
    }
}

function printTestSummary() {
    const averageResponseTime = totalResponseTime / successfulRequests || 0;
    logger.info('Test Completed');
    logger.info(`Total Requests: ${totalRequests}`);
    logger.info(`Successful Requests: ${successfulRequests}`);
    logger.info(`Failed Requests: ${failedRequests}`);
    logger.info(`Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
}

startTest();
