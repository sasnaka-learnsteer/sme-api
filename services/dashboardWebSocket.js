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

        const pSme25 = mongoPool.getCollection('sme25registrations')
            .then(col => col.aggregate([
                {
                    $match: { final_exam_center: { $exists: true, $ne: null, $ne: "" } }
                },
                {
                    $group: {
                        _id: '$final_exam_center',
                        confirmed_count: { $sum: 1 }
                    }
                }
            ]).toArray());

        const pSme26Confirmed = mongoPool.getCollection('sme26registrations')
            .then(col => col.aggregate([
                {
                    $project: {
                        centerToGroup: {
                            $cond: [
                                { $and: [ { $ne: ["$final_exam_center", null] }, { $ne: ["$final_exam_center", ""] } ] },
                                "$final_exam_center",
                                "$Preferred Exam Center"
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: '$centerToGroup',
                        confirmed_count: { $sum: 1 }
                    }
                }
            ]).toArray());

        const pSme26Registered = mongoPool.getCollection('sme26registrations')
            .then(col => col.aggregate([
                {
                    $group: {
                        _id: '$Preferred Exam Center',
                        registered_count: { $sum: 1 }
                    }
                }
            ]).toArray());

        const [sme25Res, sme26ConfRes, sme26RegRes] = await Promise.all([pSme25, pSme26Confirmed, pSme26Registered]);

        const centerMap = new Map();
        
        const mergeResults = (results, countField) => {
            for (const item of results) {
                if (!item._id) continue;
                const prev = centerMap.get(item._id) || { confirmed_count: 0, registered_count: 0 };
                prev[countField] += item[countField] || 0;
                centerMap.set(item._id, prev);
            }
        };

        mergeResults(sme25Res, 'confirmed_count');
        mergeResults(sme26ConfRes, 'confirmed_count');
        mergeResults(sme26RegRes, 'registered_count');

        // Sort alphabetically and shape into output format
        const result = Array.from(centerMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([center, counts]) => ({ 
                center, 
                confirmed_count: counts.confirmed_count,
                registered_count: counts.registered_count 
            }));

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
