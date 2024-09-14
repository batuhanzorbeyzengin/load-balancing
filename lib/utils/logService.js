const winston = require('winston');
require('winston-daily-rotate-file');

const logDir = 'logs';

const transport = new (winston.transports.DailyRotateFile)({
  filename: `${logDir}/%DATE%-loadBalancer.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    transport,
    new winston.transports.Console()
  ]
});

module.exports = logger;
