// scheduler.js
const cron = require('node-cron');
const { syncData, cleanCollection } = require('./scheduler/dataSyncToMongo_scheduled.js');
const { updateExamIndexNumbers } = require('./services/indexNumberGenerator');
const { assignCandidatesToPanelMembers } = require('./utils/candidateAssignment');

const initScheduler = () => {
    console.log('Initializing scheduler...');

    // Daily task at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Running daily scheduled task:', new Date().toISOString());
            cleanCollection();
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });

    // Run at 1:00 AM every day (when system load is typically low)
    cron.schedule('0 1 * * *', async () => {
        try {
            console.log('Running daily scheduled task:', new Date().toISOString());
            console.log('Running scheduled index number generation');
            updateExamIndexNumbers();
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });

    // Run at 3:00 AM every day
    // This time is chosen because:
    // 1. System load is typically at its lowest
    // 2. It's before business hours but gives time to address any issues before the next day
    // 3. Database maintenance operations are less likely to interfere
    cron.schedule('0 3 * * *', async () => {
        try {
            console.log('Running daily candidate assignment task:', new Date().toISOString());
            const result = await assignCandidatesToPanelMembers();
            console.log('Assignment result:', result);

            if (!result.success) {
                // Log detailed error for administrative review
                console.error('Assignment FAILED:', result.message);
            } else if (result.assignedCount > 0) {
                // Log successful assignments
                console.log(`Assignment SUCCESS`);
            }
        } catch (error) {
            console.error('Candidate assignment scheduler error:', error);
        }
    });

    // Every 1 hr task
    cron.schedule('0 * * * *', () => {
        console.log('Every 1 hr task running:', new Date().toISOString());
        syncData();
    });

    // Run at startup
    cleanCollection();
    syncData().then(() => {
        updateExamIndexNumbers();
        assignCandidatesToPanelMembers();
    });


    console.log('Data sync to MONGO scheduler started. Will run every 1 hour.');
    console.log('Index number generation will run once per day at 1:00 AM');

    console.log('Scheduler initialized successfully');
};

module.exports = { initScheduler };
