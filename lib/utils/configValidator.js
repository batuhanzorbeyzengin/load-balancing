const Joi = require('joi');

const configSchema = Joi.object({
  servers: Joi.array().items(
    Joi.object({
      host: Joi.string().required(),
      port: Joi.number().required(),
      weight: Joi.number().optional()
    })
  ).required(),
  loadBalancer: Joi.object({
    algorithm: Joi.string().valid('leastConnections', 'weighted').required(),
    port: Joi.number().required(),
    useSSL: Joi.boolean().required(),
    blockedRegions: Joi.array().items(Joi.string()).required(),
    rateLimit: Joi.number().required(),
    rateLimitWindow: Joi.number().required(),
    healthCheckInterval: Joi.number().required(),
    healthCheckTimeout: Joi.number().required(),
    retryAttempts: Joi.number().required(),
    ipRateLimit: Joi.number().required(),
    ddosThreshold: Joi.number().required()
  }).required(),
  ssl: Joi.when('loadBalancer.useSSL', {
    is: true,
    then: Joi.object({
      keyPath: Joi.string().min(1).required(),
      certPath: Joi.string().min(1).required()
    }),
    otherwise: Joi.object({
      keyPath: Joi.string().allow(''),
      certPath: Joi.string().allow('')
    })
  }).optional(),
  ports: Joi.object({
    http: Joi.number().required(),
    https: Joi.number().required(),
    http3: Joi.number().required()
  }).required(),
  enableHTTP3: Joi.boolean().required(),
  cache: Joi.object({
    enabled: Joi.boolean().required(),
    type: Joi.string().valid('redis', 'memcached').required(),
    host: Joi.string().required(),
    port: Joi.number().required(),
    ttl: Joi.number().required()
  }).required(),
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
    file: Joi.string().allow('').required()
  }).required(),
  healthReport: Joi.object({
    interval: Joi.number().required()
  }).required()
}).unknown(true);

function validateConfig(config) {
  const { error, value } = configSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  return value;
}

module.exports = { validateConfig };