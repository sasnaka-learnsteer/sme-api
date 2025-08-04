// scheduler.js
const cron = require('node-cron');
const { syncData } = require('./scheduler/dataSyncToMongo_scheduled.js');

// Schedule job to run every 30 minutes
// Cron format: '*/30 * * * *' means "every 30 minutes"
const task = cron.schedule('*/5 * * * *', () => {
    syncData();
    logNextExecutionTime();
}, {
    scheduled: true
});

// Function to log the next execution time with countdown
function logNextExecutionTime() {
    const now = new Date();
    const minutesNow = now.getMinutes();

    // Calculate next execution time (either at 0 or 30 minutes)
    const nextMinutes = minutesNow >= 30 ? 60 : 30;
    const minutesUntilNextRun = nextMinutes - (minutesNow % 30);

    const nextExecutionTime = new Date(now.getTime() + minutesUntilNextRun * 60000);


    console.log('----------------------------------------------');
    console.log(`Next scheduled execution at: ${nextExecutionTime.toISOString()}`);
    console.log(`Time until next execution: ${minutesUntilNextRun} minutes`);
    console.log('----------------------------------------------');
}

// Run once at startup
syncData();
logNextExecutionTime();

console.log('Data sync to MONGO scheduler started. Will run every 30 minutes.');

module.exports = task;
