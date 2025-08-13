// server.js
const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
const { initializeWebSocket, broadcastDashboardUpdate } = require('./services/dashboardWebSocket');

// Connected clients
const clients = new Set();

// Initialize WebSocket once when server starts
initializeWebSocket(server);

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// API endpoint to receive webhook calls from Google Apps Script
app.use(bodyParser.json());
app.post('/api/webhook/new-registration', (req, res) => {
    const data = req.body;
    console.log('Received new registration from district:', data.district);

    // Broadcast to all connected clients
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'new_registration',
                district: data.district || 'Unknown'
            }));
        }
    });

    res.status(200).send('Notification sent to all clients');
});

const PORT = process.env.WEBSOCKET_PORT || 3002;
server.listen(PORT, () => {
    console.log(`server for WEBHOOK & WEBSOCKET running on port ${PORT}`);
});


module.exports = { broadcastDashboardUpdate };