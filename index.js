const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initScheduler } = require('./scheduler'); // Import scheduler
const { spawn } = require('child_process');

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

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}



// server.js process goes here
console.log('Starting server for WEBHOOK, from index.js...');

// Spawn server.js as a child process
const serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
  stdio: 'inherit' // This will pipe the child's stdout/stderr to the parent process
});

// Handle server process events
serverProcess.on('error', (err) => {
  console.error('Failed to start server for WEBHOOK process:', err);
});

serverProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    console.log(`server for WEBHOOK process exited with code ${code} and signal ${signal}`);
  }
});

// Handle parent process termination
process.on('SIGTERM', () => {
  console.log('Terminating server for WEBHOOK process...');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Terminating server for WEBHOOK process...');
  serverProcess.kill();
  process.exit(0);
});

console.log('server for WEBHOOK started in background. Main process continuing...');

app.listen(PORT, () => {
  console.log(`Main Server is running on port ${PORT}`);
  // Start the scheduler when the server starts
  initScheduler();
});
