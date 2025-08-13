// services/dashboardWebSocket.js
const WebSocket = require('ws');
const CandidateModel = require('../models/Candidate');
const jwt = require('jsonwebtoken');

let wss;
let isInitialized = false;

function initializeWebSocket(server) {
    if (isInitialized) {
        console.log('WebSocket server already initialized');
        return;
    }
    wss = new WebSocket.Server({
        server,
        path: '/ws/dashboard',
        verifyClient: (info) => {
            const url = new URL(info.req.url, `https://${info.req.headers.host}`);
            const token = url.searchParams.get('token');

            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return true;
            } catch (error) {
                return false;
            }
            // return true;
        }
    });

    wss.on('connection', handleConnection);
    isInitialized = true;
    console.log('Dashboard WebSocket server initialized');
}

async function calculateDashboardData() {
    try {
        const centers = ['Colombo', 'Kandy', 'Galle'];
        const result = {};

        for (const center of centers) {
            const centerKey = center.toLowerCase();

            const total = await CandidateModel.countDocuments({
                'Preferred Exam Center': center
            });

            const confirmed = await CandidateModel.countDocuments({
                'Preferred Exam Center': center,
                'participation_status': 'confirmed'
            });

            const rejected = await CandidateModel.countDocuments({
                'Preferred Exam Center': center,
                'participation_status': 'rejected'
            });

            const not_reachable = await CandidateModel.countDocuments({
                'Preferred Exam Center': center,
                'participation_status': 'not_reachable'
            });

            result[centerKey] = { total, confirmed, rejected, not_reachable };
        }

        return result;
    } catch (error) {
        console.error('Error calculating dashboard data:', error);
        return null;
    }
}

function handleConnection(ws) {
    console.log('Dashboard client connected');

    const sendDashboardData = async () => {
        const data = await calculateDashboardData();
        if (data && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    };

    sendDashboardData();
    const interval = setInterval(sendDashboardData, 30000);

    ws.on('close', () => {
        console.log('Dashboard client disconnected');
        clearInterval(interval);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearInterval(interval);
    });
}

async function broadcastDashboardUpdate() {
    if (!wss) return;

    const data = await calculateDashboardData();
    if (data) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

function closeWebSocket() {
    if (wss) {
        wss.close();
        wss = null;
        isInitialized = false;
    }
}



module.exports = {
    initializeWebSocket,
    broadcastDashboardUpdate,
    closeWebSocket
};
