// scheduler.js
const cron = require('node-cron');
const { syncData, cleanCollection } = require('./scheduler/dataSyncToMongo_scheduled.js');
const { updateExamIndexNumbers } = require('./services/indexNumberGenerator');
const { assignCandidatesToPanelMembers } = require('./utils/candidateAssignment');
const {cleanAdminCollection, syncAdminData} = require("./scheduler/adminDataSyncToMongo");
const {generateAndStoreQRCodes} = require("./routes/qrCodeRoutes");

const initScheduler = () => {
    console.log('Initializing scheduler...');

    // Daily task at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Running daily scheduled task: cleanCollection() & cleanAdminCollection()', new Date().toISOString());
            await cleanCollection();
            await cleanAdminCollection()
            console.log('Completed daily scheduled task: cleanCollection() & cleanAdminCollection()', new Date().toISOString());
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });
    console.log('[CRON JOB] cleanCollection() & cleanAdminCollection() is started. Will run daily at midnight.');

    // Run at 1:00 AM every day (when system load is typically low)
    // cron.schedule('0 1 * * *', async () => {
    //     try {
    //         console.log('Running daily scheduled task:', new Date().toISOString());
    //         console.log('Running scheduled index number generation');
    //         updateExamIndexNumbers();
    //     } catch (error) {
    //         console.error('Scheduler error:', error);
    //     }
    // });
    console.log('[CRON JOB] Daily Index Number generation for candidates is turned OFF now');

    // Run at 3:00 AM every day
    // This time is chosen because:
    // 1. System load is typically at its lowest
    // 2. It's before business hours but gives time to address any issues before the next day
    // 3. Database maintenance operations are less likely to interfere
    // cron.schedule('0 3 * * *', async () => {
    //     try {
    //         console.log('Running daily candidate assignment task:', new Date().toISOString());
    //         const result = await assignCandidatesToPanelMembers();
    //         console.log('Assignment result:', result);
    //
    //         if (!result.success) {
    //             // Log detailed error for administrative review
    //             console.error('Assignment FAILED:', result.message);
    //         } else if (result.assignedCount > 0) {
    //             // Log successful assignments
    //             console.log(`Assignment SUCCESS`);
    //         }
    //     } catch (error) {
    //         console.error('Candidate assignment scheduler error:', error);
    //     }
    // });
    console.log('[CRON JOB] Assigning Candidates to panel members is turned OFF now');

    // Every 1 hr task
    cron.schedule('0 * * * *', () => {
        console.log('Every 1 hr task running:', new Date().toISOString());
        console.log('Running hourly scheduled task: syncData() & syncAdminData()', new Date().toISOString());
        syncData().then(() => console.log('Completed hourly scheduled task: syncData()', new Date().toISOString()));
        syncAdminData().then(() => console.log('Completed hourly scheduled task: syncAdminData()', new Date().toISOString()));
        console.log('Running hourly scheduled task: generateAndStoreQRCodes()', new Date().toISOString());
        generateAndStoreQRCodes().then(() => console.log('Completed hourly scheduled task: generateAndStoreQRCodes()', new Date().toISOString()))
    });
    console.log('[CRON JOB] Data sync to MONGO is started. Will run every 1 hour.');
    console.log('[CRON JOB] Generate QR code for candidates is started. Will run every 1 hour.');

    // Run at startup
    console.log('cleanCollection() & cleanAdminCollection() is STARTED [ONE time RUN at START]');
    cleanCollection().then(() => console.log('cleanCollection() is FINISHED'));
    cleanAdminCollection().then(() => console.log('cleanAdminCollection() is FINISHED'))

    console.log('syncData() is STARTED [ONE time RUN at START]');
    syncData().then(() => {
        console.log('syncData() is FINISHED. Starting other jobs...')
        syncAdminData().then(() => console.log('syncAdminData() is FINISHED'))
        // updateExamIndexNumbers();
        console.log('Index number generation [ONE time RUN at START] - TURNED OFF now');
        console.log('Assign Candidates to Panel Members [ONE time RUN at START] - TURNED OFF now');
        // console.log('Assign Candidates to Panel Members is STARTED [ONE time RUN at START]');
        // assignCandidatesToPanelMembers();
        // console.log('Assign Candidates to Panel Members is FINISHED');
        console.log('Generate QR code for candidates is STARTED [ONE time RUN at START]');
        generateAndStoreQRCodes().then(() => console.log('Generate QR code for candidates is FINISHED'))
    });

    console.log('Scheduler initialized successfully');
};

module.exports = { initScheduler };
