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
  }).optional()
});

function validateConfig(config) {
  const { error } = configSchema.validate(config);
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
}

module.exports = { validateConfig };
