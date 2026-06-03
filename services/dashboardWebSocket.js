// services/dashboardWebSocket.js
const WebSocket = require('ws');
const mongoPool = require('./mongoConnectionPool');
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
            const token = (url.searchParams.get('token') || '').trim();

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

        const COLLECTIONS = ['sme25registrations', 'sme26registrations'];
        const pipeline = [
            {
                $group: {
                    _id: '$Preferred Exam Center',
                    count: { $sum: 1 }
                }
            }
        ];

        // Run aggregation on both collections in parallel
        const results = await Promise.all(
            COLLECTIONS.map(name => mongoPool.getCollection(name)
                .then(col => col.aggregate(pipeline).toArray())
            )
        );

        // Merge counts across both collections by center name
        const centerMap = new Map();
        for (const colResult of results) {
            for (const item of colResult) {
                if (!item._id) continue; // skip null / empty
                const prev = centerMap.get(item._id) || 0;
                centerMap.set(item._id, prev + item.count);
            }
        }

        // Sort alphabetically and shape into { center, count } array
        const result = Array.from(centerMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([center, count]) => ({ center, count }));

        // Cache the result
        cachedDashboardData = result;
        lastCacheUpdate = now;

        return result;
    } catch (error) {
        console.error('Error calculating dashboard data:', error);
        return cachedDashboardData || null;
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
