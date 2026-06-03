const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const { initScheduler } = require('./scheduler');
const { initializeWebSocket } = require('./services/dashboardWebSocket');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/candidate', require('./routes/candidateRoutes'));
app.use('/api/qrcode', require('./routes/qrCodeRoutes'));
app.use('/api/results', require('./routes/resultRoutes'));

// Webhook WebSocket — broadcasts new_registration events
const clients = new Set();

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Webhook endpoint — notify all connected WebSocket clients
app.post('/api/webhook/new-registration', (req, res) => {
  const data = req.body;
  console.log('Received new registration from district:', data.district);

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

// Create a single HTTP server shared by Express + both WebSocket servers
const server = http.createServer(app);

// Dashboard WebSocket — JWT-protected, handles /ws/dashboard
const { getDashboardWss } = require('./services/dashboardWebSocket');
initializeWebSocket(server);

// Webhook WebSocket — unauthenticated, handles all other WS paths
const webhookWss = new WebSocket.Server({ noServer: true });
webhookWss.on('connection', (ws) => {
  console.log('Webhook WebSocket client connected');
  clients.add(ws);
  ws.on('close', () => {
    console.log('Webhook WebSocket client disconnected');
    clients.delete(ws);
  });
});

// Route WebSocket upgrades manually to prevent double-handling
server.on('upgrade', (req, socket, head) => {
  const pathname = req.url.split('?')[0];
  if (pathname === '/ws/dashboard') {
    // Handled internally by dashboardWebSocket's WSS (noServer mode)
    const dashWss = getDashboardWss();
    if (dashWss) {
      dashWss.handleUpgrade(req, socket, head, (ws) => {
        dashWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  } else {
    webhookWss.handleUpgrade(req, socket, head, (ws) => {
      webhookWss.emit('connection', ws, req);
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (REST + WebSocket)`);
  initScheduler().catch(err => {
    console.error('Scheduler initialization failed — server continues running:', err);
  });
});
