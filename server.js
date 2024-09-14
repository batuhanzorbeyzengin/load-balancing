const http = require('http');

function getRandomDelay() {
    return Math.floor(Math.random() * 1000) + 100;
}

function startServer(port) {
    http.createServer((req, res) => {
        const delay = getRandomDelay();

        setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`Handled by server on port ${port} after ${delay}ms delay\n`);
        }, delay);
    }).listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
}

startServer(3001);
startServer(3002);
startServer(3003);
