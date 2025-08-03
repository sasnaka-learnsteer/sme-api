// scheduler.js
const cron = require('node-cron');
const { syncData } = require('./scheduler/dataSyncToMongo_scheduled.js');

// Schedule job to run every 30 minutes
// Cron format: '*/30 * * * *' means "every 30 minutes"
cron.schedule('*/30 * * * *', syncData);

console.log('Data sync to MONGO scheduler started. Will run every 30 minutes.');

// Run once at startup
syncData();