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

This Advanced Load Balancer is a robust, scalable solution designed to efficiently distribute incoming network traffic across multiple servers. It supports multiple load balancing algorithms, real-time health monitoring, and includes advanced security features to protect against various types of attacks.

## Features

1. **Load Balancing Algorithms**
   - Round Robin
   - Weighted Round Robin
   - Least Connections
   - IP Hash
   - Consistent Hashing
   - Dynamic Weighted
   - Least Response Time
   - URL Hash

2. **Sticky Sessions (Session Affinity)**

3. **Advanced Security Features**
   - IP-based rate limiting
   - DDoS protection (configurable)
   - Bot detection
   - Geo-blocking
   - IP banning (configurable)

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

- Node.js (v18.0.0 or later)
- Redis (for caching and rate limiting)
- Memcached (optional, for distributed caching)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/batuhanzorbeyzengin/load-balancing.git
   ```

2. Navigate to the project directory:
   ```
   cd load-balancing
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
    {
      "host": "http://localhost",  // String: Server URL (Required)
      "port": 3001,                // Number: Server port (Required)
      "weight": 3                  // Number: Server weight for weighted algorithms (Optional, default: 1)
    },
    {
      "host": "http://localhost",
      "port": 3002,
      "weight": 2
    }
  ],
  "loadBalancer": {
    "algorithm": "roundRobin",     // String: Load balancing algorithm (Optional, default: "roundRobin")
                                   // Possible values: "roundRobin", "weightedRoundRobin", "leastConnections", 
                                   // "ipHash", "consistentHashing", "dynamicWeighted", "leastResponseTime", "urlHash"
    "port": 8088,                  // Number: Port on which the load balancer listens (Required)
    "useSSL": false,               // Boolean: Whether to use SSL/TLS (Required)
    "blockedRegions": ["CN", "RU"],// Array of Strings: Country codes to block (Optional, default: [])
    "rateLimit": 100,              // Number: Max requests per server in rate limit window (Required)
    "rateLimitWindow": 60000,      // Number: Time window for rate limiting in ms (Required)
    "healthCheckInterval": 10000,  // Number: Interval between health checks in ms (Required)
    "healthCheckTimeout": 5000,    // Number: Timeout for health checks in ms (Required)
    "retryAttempts": 3,            // Number: Retry attempts if a server is unavailable (Required)
    "ipRateLimit": 50,             // Number: Max requests per IP in rate limit window (Required)
    "ddosThreshold": 20,           // Number: Threshold for potential DDoS detection (Required)
    "enableDdosProtection": true,  // Boolean: Whether to enable DDoS protection (Optional, default: true)
    "enableIpBan": true            // Boolean: Whether to enable IP banning (Optional, default: true)
  },
  "ssl": {  // SSL configuration (Required if useSSL is true, otherwise optional)
    "keyPath": "",                 // String: Path to SSL private key file
    "certPath": ""                 // String: Path to SSL certificate file
  },
  "ports": {
    "http": 8088,                  // Number: Port for HTTP traffic (Required)
    "https": 443,                  // Number: Port for HTTPS traffic (Required if useSSL is true)
    "http3": 443                   // Number: Port for HTTP/3 traffic (Required if enableHTTP3 is true)
  },
  "enableHTTP3": false,            // Boolean: Whether to enable HTTP/3 support (Optional, default: false)
  "cache": {
    "enabled": true,               // Boolean: Whether to enable caching (Optional, default: false)
    "type": "redis",               // String: Type of cache to use (Required if cache is enabled)
                                   // Possible values: "redis", "memcached"
    "host": "localhost",           // String: Cache server host (Required if cache is enabled)
    "port": 6379,                  // Number: Cache server port (Required if cache is enabled)
    "ttl": 3600                    // Number: Time-to-live for cached items in seconds (Required if cache is enabled)
  },
  "logging": {
    "level": "info",               // String: Logging level (Required)
                                   // Possible values: "error", "warn", "info", "debug"
    "file": ""                     // String: Path to log file (Optional, default: "" for console logging)
  },
  "healthReport": {
    "interval": 300000             // Number: Interval for health reports in ms (Optional, default: 300000)
  }
}
```

Supported values for `algorithm` are:
- `"roundRobin"`
- `"weightedRoundRobin"`
- `"leastConnections"`
- `"ipHash"`
- `"consistentHashing"`
- `"dynamicWeighted"`
- `"leastResponseTime"`
- `"urlHash"`

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

- **Round Robin**: Distributes requests evenly across all servers in sequential order.
- **Weighted Round Robin**: Similar to Round Robin, but servers with higher weights receive more requests.
- **Least Connections**: Directs new requests to the server with the least active connections.
- **IP Hash**: Uses the client's IP address to determine which server receives the request, ensuring session persistence.
- **Consistent Hashing**: Minimizes redistribution of requests when servers are added or removed.
- **Dynamic Weighted**: Adjusts server weights based on their current load and performance.
- **Least Response Time**: Sends requests to the server with the lowest average response time.
- **URL Hash**: Uses the requested URL to determine which server receives the request.

## Security Features

- **IP-Based Rate Limiting**: Limits requests from a single IP within a specified time window.
- **DDoS Protection**: Detects and mitigates potential DDoS attacks using various metrics. Can be enabled/disabled in configuration.
- **Bot Detection**: Identifies and blocks requests from known bot user agents.
- **Geo-Blocking**: Blocks requests from specified regions or countries.
- **IP Banning**: Automatically bans IPs that exceed rate limits. Can be enabled/disabled in configuration.

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
- `algorithm`: Choose the most appropriate algorithm for your use case.
- `enableDdosProtection`: Enable for enhanced security, disable for reduced overhead if not needed.
- `enableIpBan`: Enable for stricter security, disable if temporary rate limiting is sufficient.

## Troubleshooting

- Check the `logs` directory for detailed error logs and information.
- Ensure Redis and Memcached (if used) are running and accessible.
- Verify that all backend servers are operational and reachable.
- Check firewall settings if experiencing connection issues.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.