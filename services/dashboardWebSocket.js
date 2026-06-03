// services/dashboardWebSocket.js
const WebSocket = require('ws');
const CandidateModel = require('../models/Candidate');
const jwt = require('jsonwebtoken');

let wss;
let isInitialized = false;
let cachedDashboardData = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache instead of 30 seconds queries
const UPDATE_INTERVAL = 2 * 60 * 1000; // Update clients every 2 minutes instead of 30 seconds

function initializeWebSocket(server) {
    if (isInitialized) {
        console.log('WebSocket server already initialized');
        return;
    }
    wss = new WebSocket.Server({
        noServer: true,
        verifyClient: (info) => {
            const url = new URL(info.req.url, `https://${info.req.headers.host}`);
            const token = url.searchParams.get('token');

            try {
                jwt.verify(token, process.env.JWT_SECRET);
                return true;
            } catch (error) {
                return false;
            }
        }
    });

    wss.on('connection', handleConnection);
    isInitialized = true;
    console.log('Dashboard WebSocket server initialized');
}

async function calculateDashboardData() {
    try {
        // Use cached data if still valid
        const now = Date.now();
        if (cachedDashboardData && (now - lastCacheUpdate) < CACHE_DURATION) {
            return cachedDashboardData;
        }

        // Aggregate count per exam center — works for any center values in the DB
        const aggregationResult = await CandidateModel.aggregate([
            {
                $match: {
                    'Preferred Exam Center': { $exists: true, $ne: null, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$Preferred Exam Center',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // alphabetical by center name
            }
        ]);

        // Shape into array of { center, count } objects
        const result = aggregationResult.map(item => ({
            center: item._id,
            count: item.count
        }));

        // Cache the result
        cachedDashboardData = result;
        lastCacheUpdate = now;

        return result;
    } catch (error) {
        console.error('Error calculating dashboard data:', error);
        return cachedDashboardData || null; // Return cached data on error
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
    // Reduced frequency from 30 seconds to 2 minutes
    const interval = setInterval(sendDashboardData, UPDATE_INTERVAL);

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

    // Force cache refresh for broadcast updates
    cachedDashboardData = null;
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



function getDashboardWss() {
    return wss;
}

module.exports = {
    initializeWebSocket,
    broadcastDashboardUpdate,
    closeWebSocket,
    getDashboardWss
};
