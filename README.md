# Load Balancer Project

## About the Project

This project is a scalable **load balancing** solution that supports both **weighted** and **least connections** algorithms. The load balancer distributes incoming requests across servers efficiently and provides real-time monitoring of server health. Additionally, the project includes security features like DDoS protection and bot detection to safeguard against malicious traffic.

### Project Structure

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
├─ package.json
├─ routes
│  └─ handleRequest.js
└─ src
   ├─ loadBalancer.js
   ├─ server.js
   └─ testRequests.js
```

## Features

### 1. **Load Balancing Algorithms**
- **Weighted**: Distributes more traffic to stronger servers. The traffic is distributed based on the server weights defined in the configuration.
- **Least Connections**: Directs new requests to the server with the least active connections, balancing the load across servers.

### 2. **Sticky Sessions (Session Affinity)**
Requests from the same client are routed to the same server. This is useful for session-based applications where the client's IP or session needs to be consistently routed to the same server.

### 3. **IP-Based Rate Limiting**
Limits the number of requests a single IP address can make within a given time window. If the limit is exceeded, the IP is blocked temporarily.

### 4. **DDoS Protection and Bot Detection**
Detects abnormal traffic patterns and blocks suspicious behavior, such as too many requests in a short period or bot-like `User-Agent` headers. The system uses a combination of request rate analysis, pattern recognition, and geographical anomaly detection.

### 5. **Geo-Blocking**
Requests from specific regions or countries can be blocked based on the IP address's geographic location, as defined in the `blockedRegions` field of the configuration.

### 6. **Real-Time Server Health Monitoring**
Monitors the CPU and memory usage of the servers in real-time. The system provides a constantly updating display of server health information and can adjust load balancing based on server performance.

### 7. **SSL Support**
The load balancer supports SSL for secure HTTPS connections. When `useSSL` is set to `true`, the SSL certificate and key paths must be specified in the configuration file.

### 8. **HTTP/2 and HTTP/3 Support**
The load balancer now supports HTTP/2 and HTTP/3 protocols, providing improved performance and security for modern web applications.

### 9. **Automated Test Requests**
You can send test requests to the load balancer using the `testRequests.js` script. This is useful for stress testing and ensuring proper load distribution.

### 10. **Flexible Caching**
Implements a distributed caching system to improve response times and reduce load on backend servers.

### 11. **Advanced Logging**
Comprehensive logging system that captures various levels of information (error, warn, info, debug) and supports log rotation.

### 12. **Configuration Validation**
Robust configuration validation to ensure all necessary settings are properly defined before starting the load balancer.

## Installation

This project requires **Node.js**. Before running the project, make sure to install the necessary dependencies.

### 1. Install Dependencies

```bash
npm install
```

## Create SSL Certificate (If Using SSL)

If you plan to use SSL (useSSL: true), you need to place the SSL certificate and key files in the ssl/ directory.

```bash
mkdir ssl
```

Example SSL files:
- ssl/cert.pem (certificate)
- ssl/key.pem (private key)

## Configure the config.json File
Edit the config.json file according to your environment. Below is an example configuration:
```json
{
  "servers": [
    {
      "host": "http://localhost",  // Server URL
      "port": 3001,                // Server port
      "weight": 3                  // Server weight for weighted algorithm (optional)
    },
    {
      "host": "http://localhost",
      "port": 3002,
      "weight": 2
    },
    {
      "host": "http://localhost",
      "port": 3003,
      "weight": 1
    }
  ],
  "loadBalancer": {
    "algorithm": "weighted",       // "weighted" or "leastConnections"
    "port": 8088,                  // Load balancer listening port
    "useSSL": false,               // Enable/disable SSL (true/false)
    "blockedRegions": ["CN", "RU"],// Blocked regions based on country codes (ISO Alpha-2)
    "rateLimit": 100,              // Max requests per server before rate-limiting kicks in
    "rateLimitWindow": 60000,      // Time window for rate limiting in milliseconds (e.g., 60000 = 1 minute)
    "healthCheckInterval": 10000,  // Interval between health checks in milliseconds
    "healthCheckTimeout": 5000,    // Timeout for health checks in milliseconds
    "retryAttempts": 3,            // Number of retries if a server is unavailable
    "ipRateLimit": 50,             // Max requests per IP before blocking
    "ddosThreshold": 1000          // Max requests in 60 seconds before considering DDoS
  },
  "ssl": {
    "keyPath": "",                 // Path to SSL private key (leave empty if useSSL is false)
    "certPath": ""                 // Path to SSL certificate (leave empty if useSSL is false)
  },
  "ports": {
    "http": 80,                    // HTTP port
    "https": 443,                  // HTTPS port
    "http3": 443                   // HTTP/3 port
  },
  "enableHTTP3": false,            // Enable/disable HTTP/3 support
  "cache": {
    "enabled": true,
    "type": "redis",               // Cache type (redis or memcached)
    "host": "localhost",
    "port": 6379,
    "ttl": 3600                    // Time-to-live for cached items in seconds
  },
  "logging": {
    "level": "info",               // Logging level (error, warn, info, debug)
    "file": "loadbalancer.log"     // Log file path
  },
  "healthReport": {
    "interval": 300000             // Health report interval in milliseconds (5 minutes)
  }
}
```

## Start the Backend Servers
Run the backend servers using the server.js script. These servers will be used by the load balancer to distribute traffic.

```bash
node src/server.js
```

## Start the Load Balancer
Start the load balancer using the following command:

```bash
node src/loadBalancer.js
```

## Run Automated Test Requests
To send test requests to the load balancer:

```bash
node src/testRequests.js
```

## Logging
All logs are saved in the logs/ directory. Logs are rotated daily and kept for 14 days.
- error.log: Contains error messages.
- info.log: Contains general information messages.
- warn.log: Contains warning messages.
- debug.log: Contains detailed debug information.

## Performance Tuning
The load balancer includes several configurable parameters for performance tuning. Adjust these in the `config.json` file based on your specific requirements and traffic patterns:

- `ddosThreshold`: Adjust this value based on your expected legitimate traffic volume.
- `rateLimit` and `ipRateLimit`: Fine-tune these values to balance between protecting your servers and allowing high-traffic legitimate users.
- `healthCheckInterval` and `healthCheckTimeout`: Adjust these for more or less frequent health checks.
- `cache.ttl`: Set an appropriate cache time-to-live based on your application's data update frequency.

## Security Considerations
- Regularly update the `blockedRegions` list based on your security requirements.
- Monitor the logs for any suspicious activities and adjust the security parameters accordingly.
- Keep the SSL certificates up-to-date if SSL is enabled.

## Troubleshooting
- If you encounter issues with SSL, ensure that the certificate and key files are correctly placed and the paths are properly specified in the config file.
- For performance issues, check the server health logs and consider adjusting the load balancing algorithm or server weights.
- If legitimate traffic is being blocked, review and adjust the DDoS protection and rate limiting parameters in the configuration.

Remember to restart the load balancer after making changes to the configuration file.