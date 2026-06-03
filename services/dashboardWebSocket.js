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

        const centers = ['Colombo', 'Kandy', 'Galle'];
        const result = {};

        // Use aggregation pipeline for efficient single query instead of multiple queries
        const aggregationResult = await CandidateModel.aggregate([
            {
                $match: {
                    'Preferred Exam Center': { $in: centers }
                }
            },
            {
                $group: {
                    _id: {
                        center: '$Preferred Exam Center',
                        status: '$participation_status'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Initialize result structure
        centers.forEach(center => {
            const centerKey = center.toLowerCase();
            result[centerKey] = { total: 0, confirmed: 0, rejected: 0, not_reachable: 0 };
        });

        // Process aggregation results
        aggregationResult.forEach(item => {
            const centerKey = item._id.center.toLowerCase();
            const status = item._id.status || 'unknown';

            if (result[centerKey]) {
                result[centerKey].total += item.count;
                if (result[centerKey][status] !== undefined) {
                    result[centerKey][status] = item.count;
                }
            }
        });

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
