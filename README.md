# Load Balancer Project

## About the Project

This project is a scalable **load balancing** solution that supports both **weighted** and **least connections** algorithms. The load balancer distributes incoming requests across servers efficiently and provides real-time monitoring of server health. Additionally, the project includes security features like DDoS protection and bot detection to safeguard against malicious traffic.

### Project Structure


```
loacbalancer
├─ README.md
├─ config-test.json
├─ config.json
├─ loadBalancer.js
├─ package-lock.json
├─ package.json
├─ routes
│  └─ handleRequest.js
├─ server.js
├─ ssl
├─ testRequests.js
└─ utils
   ├─ configValidator.js
   ├─ ddosProtection.js
   ├─ geoIPCheck.js
   ├─ healthCheck.js
   ├─ ipRateLimit.js
   ├─ loadBalancerUtils.js
   ├─ logService.js
   ├─ performanceMonitor.js
   ├─ rateLimit.js
   └─ realTimeHealthMonitor.js

```

## Features

### 1. **Load Balancing Algorithms**
- **Weighted**: Distributes more traffic to stronger servers. The traffic is distributed based on the server weights defined in the configuration.
- **Least Connections**: Directs new requests to the server with the least active connections, balancing the load across servers.

### 2. **Sticky Sessions (Session Affinity)**
Requests from the same client are routed to the same server. This is useful for session-based applications where the client’s IP or session needs to be consistently routed to the same server.

### 3. **IP-Based Rate Limiting**
Limits the number of requests a single IP address can make within a given time window. If the limit is exceeded, the IP is blocked temporarily.

### 4. **DDoS Protection and Bot Detection**
Detects abnormal traffic patterns and blocks suspicious behavior, such as too many requests in a short period or bot-like `User-Agent` headers.

### 5. **Geo-Blocking**
Requests from specific regions or countries can be blocked based on the IP address’s geographic location, as defined in the `blockedRegions` field of the configuration.

### 6. **Real-Time Server Health Monitoring**
Monitors the CPU and memory usage of the servers in real-time via the terminal. The **realTimeMonitor.js** script provides a constantly updating display of server health information.

### 7. **SSL Support**
The load balancer supports SSL for secure HTTPS connections. When `useSSL` is set to `true`, the SSL certificate and key paths must be specified in the configuration file.

### 8. **Automated Test Requests**
You can send test requests to the load balancer using the **testRequests.js** script. This is useful for stress testing and ensuring proper load distribution.

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
    "ddosThreshold": 20            // Max requests in 10 seconds before considering DDoS
  },
  "ssl": {
    "keyPath": "",                 // Path to SSL private key (leave empty if useSSL is false)
    "certPath": ""                 // Path to SSL certificate (leave empty if useSSL is false)
  }
}

```


## Start the Backend Servers
Run the backend servers using the server.js script. These servers will be used by the load balancer to distribute traffic.

```bash
node server.js
```

## Start the Load Balancer
Start the load balancer using the following command:

```bash
node loadBalancer.js
```

## Run Automated Test Requests
To send test requests to the load balancer:

```bash
node testRequests.js
```

## Start Real-Time Server Monitoring
Monitor the health and performance of the servers in real-time from the terminal:

```bash
node realTimeMonitor.js
```

This command will show real-time updates of CPU usage, memory usage, and the overall status of the servers.

## Logging
All logs are saved in the logs/ directory. Logs are rotated daily and kept for 14 days.
- error.log: Contains error messages.
- info.log: Contains general information messages.
- warn.log: Contains warning messages.
- success.log: Logs successful requests.