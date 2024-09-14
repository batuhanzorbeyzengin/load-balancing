# Advanced Load Balancer

## Table of Contents
- [About the Project](#about-the-project)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Load Balancing Algorithms](#load-balancing-algorithms)
- [Security Features](#security-features)
- [Monitoring and Logging](#monitoring-and-logging)
- [Performance Tuning](#performance-tuning)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## About the Project

This Advanced Load Balancer is a robust, scalable solution designed to efficiently distribute incoming network traffic across multiple servers. It supports both weighted and least connections algorithms, real-time health monitoring, and includes advanced security features to protect against various types of attacks.

## Features

1. **Load Balancing Algorithms**
   - Weighted distribution
   - Least connections

2. **Sticky Sessions (Session Affinity)**

3. **Advanced Security Features**
   - IP-based rate limiting
   - DDoS protection
   - Bot detection
   - Geo-blocking

4. **Real-Time Server Health Monitoring**

5. **SSL/TLS Support**

6. **HTTP/2 and HTTP/3 Support**

7. **Distributed Caching System**

8. **Comprehensive Logging and Monitoring**

9. **Automated Test Suite**

10. **Configuration Validation**

## Project Structure

```
├─ config
│  ├─ config-test.json
│  └─ config.json
├─ lib
│  ├─ balancer
│  │  ├─ healthCheck.js
│  │  └─ loadBalancerUtils.js
│  ├─ cache
│  │  └─ distributedCache.js
│  ├─ security
│  │  ├─ ddosProtection.js
│  │  ├─ geoIPCheck.js
│  │  └─ rateLimit.js
│  └─ utils
│     ├─ configValidator.js
│     ├─ logService.js
│     └─ performanceMonitor.js
├─ routes
│  └─ handleRequest.js
├─ src
│  ├─ loadBalancer.js
│  ├─ server.js
│  └─ testRequests.js
├─ package.json
└─ README.md
```

## Prerequisites

- Node.js (v14.0.0 or later)
- Redis (for caching and rate limiting)
- Memcached (optional, for distributed caching)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/advanced-load-balancer.git
   ```

2. Navigate to the project directory:
   ```
   cd advanced-load-balancer
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Set up Redis and Memcached (if using).

5. Configure the `config/config.json` file (see [Configuration](#configuration) section).

## Configuration

Edit the `config/config.json` file to match your environment:

```json
{
  "servers": [
    // Array of server objects. Each object represents a backend server.
    { 
      "host": "http://localhost", // String: The URL of the server
      "port": 3001,               // Number: The port number
      "weight": 3                 // Number: Weight for weighted algorithm (higher number = more traffic)
    },
    { 
      "host": "http://localhost", 
      "port": 3002, 
      "weight": 2 
    }
  ],
  "loadBalancer": {
    "algorithm": "weighted",       // String: "weighted" or "leastConnections" - Determines how traffic is distributed
    "port": 8088,                  // Number: The port on which the load balancer listens
    "useSSL": false,               // Boolean: Whether to use SSL/TLS
    "blockedRegions": ["CN", "RU"],// Array of Strings: Country codes to block (ISO Alpha-2)
    "rateLimit": 100,              // Number: Maximum requests allowed per server in the rate limit window
    "rateLimitWindow": 60000,      // Number: Time window for rate limiting in milliseconds
    "healthCheckInterval": 10000,  // Number: Interval between health checks in milliseconds
    "healthCheckTimeout": 5000,    // Number: Timeout for health checks in milliseconds
    "retryAttempts": 3,            // Number: Number of retry attempts if a server is unavailable
    "ipRateLimit": 50,             // Number: Maximum requests allowed per IP address
    "ddosThreshold": 20            // Number: Threshold for detecting potential DDoS attacks
  },
  "ssl": {
    // SSL configuration (only used if useSSL is true)
    "keyPath": "",                 // String: Path to the SSL private key file
    "certPath": ""                 // String: Path to the SSL certificate file
  },
  "ports": {
    "http": 8088,                  // Number: Port for HTTP traffic
    "https": 443,                  // Number: Port for HTTPS traffic
    "http3": 443                   // Number: Port for HTTP/3 traffic
  },
  "enableHTTP3": false,            // Boolean: Whether to enable HTTP/3 support
  "cache": {
    "enabled": true,               // Boolean: Whether to enable caching
    "type": "redis",               // String: "redis" or "memcached" - Type of caching system to use
    "host": "localhost",           // String: Host of the caching server
    "port": 6379,                  // Number: Port of the caching server
    "ttl": 3600                    // Number: Time-to-live for cached items in seconds
  },
  "logging": {
    "level": "info",               // String: Logging level ("error", "warn", "info", "debug")
    "file": ""                     // String: Path to log file (empty string for console logging only)
  },
  "healthReport": {
    "interval": 300000             // Number: Interval for generating health reports in milliseconds
  }
}
```

## Usage

1. Start the backend servers:
   ```
   node src/server.js
   ```

2. Start the load balancer:
   ```
   node src/loadBalancer.js
   ```

3. To run automated test requests:
   ```
   node src/testRequests.js
   ```

## Load Balancing Algorithms

- **Weighted**: Distributes traffic based on server weights defined in the configuration.
- **Least Connections**: Directs new requests to the server with the least active connections.

## Security Features

- **IP-Based Rate Limiting**: Limits requests from a single IP within a specified time window.
- **DDoS Protection**: Detects and mitigates potential DDoS attacks using various metrics.
- **Bot Detection**: Identifies and blocks requests from known bot user agents.
- **Geo-Blocking**: Blocks requests from specified regions or countries.

## Monitoring and Logging

- Real-time server health monitoring
- Comprehensive logging with Winston
- Periodic health reports
- Performance monitoring of CPU and memory usage

## Performance Tuning

Adjust the following parameters in `config.json` for optimal performance:

- `ddosThreshold`: Adjust based on expected legitimate traffic volume.
- `rateLimit` and `ipRateLimit`: Fine-tune to balance protection and high-traffic legitimate users.
- `healthCheckInterval` and `healthCheckTimeout`: Adjust for more or less frequent health checks.
- `cache.ttl`: Set appropriate cache time-to-live based on your application's data update frequency.

## Troubleshooting

- Check the `logs` directory for detailed error logs and information.
- Ensure Redis and Memcached (if used) are running and accessible.
- Verify that all backend servers are operational and reachable.
- Check firewall settings if experiencing connection issues.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.