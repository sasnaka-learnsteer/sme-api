// scheduler.js
const cron = require('node-cron');
const { syncData, cleanCollection } = require('./scheduler/dataSyncToMongo_scheduled.js');
const { updateExamIndexNumbers } = require('./services/indexNumberGenerator');
const {cleanAdminCollection, syncAdminData} = require("./scheduler/adminDataSyncToMongo");
const {generateAndStoreQRCodes} = require("./routes/qrCodeRoutes");

const initScheduler = async () => {
    console.log('Initializing scheduler...');

    // Daily task at midnight (cleaning collections)
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Running daily scheduled task: cleanCollection() & cleanAdminCollection()', new Date().toISOString());
            await cleanCollection();
            await cleanAdminCollection();
            console.log('Completed daily scheduled task: cleanCollection() & cleanAdminCollection()', new Date().toISOString());
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });
    console.log('[CRON JOB] cleanCollection() & cleanAdminCollection() is started. Will run daily at midnight.');

    // Run syncData and syncAdminData once daily at 00:30
    cron.schedule('30 0 * * *', async () => {
        console.log('Running daily scheduled task: syncData() & syncAdminData()', new Date().toISOString());
        await syncData().then(() => console.log('Completed daily scheduled task: syncData()', new Date().toISOString()));
        await syncAdminData().then(() => console.log('Completed daily scheduled task: syncAdminData()', new Date().toISOString()));
    });
    console.log('[CRON JOB] syncData() & syncAdminData() is started. Will run daily at 00:30.');

    // Run index number generation & QR code generation once daily at 01:00
    cron.schedule('0 1 * * *', async () => {
        try {
            console.log('Running daily scheduled task: index number generation & update', new Date().toISOString());
            await updateExamIndexNumbers();
            console.log('Completed daily scheduled task: index number generation & update', new Date().toISOString());

            console.log('Running daily scheduled task: generateAndStoreQRCodes()', new Date().toISOString());
            await generateAndStoreQRCodes();
            console.log('Completed daily scheduled task: generateAndStoreQRCodes()', new Date().toISOString());
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });
    console.log('[CRON JOB] index number generation & QR code generation is started. Will run daily at 01:00.');

    // Run at startup (one-time run)
    console.log('cleanCollection() & cleanAdminCollection() is STARTED [ONE time RUN at START]');
    await cleanCollection().then(() => console.log('cleanCollection() is FINISHED'));
    await cleanAdminCollection().then(() => console.log('cleanAdminCollection() is FINISHED'));

    console.log('syncData() is STARTED [ONE time RUN at START]');
    await syncData().then(async () => {
        console.log('syncData() is FINISHED. Starting other jobs...');
        await syncAdminData().then(() => console.log('syncAdminData() is FINISHED'));
        console.log('STARTING Index number generation [ONE time RUN at START]');
        await updateExamIndexNumbers().then(() => console.log('FINISHED Index number generation [ONE time RUN at START]'));

        console.log('Assign Candidates to Panel Members [ONE time RUN at START] - TURNED OFF now');
        // console.log('Assign Candidates to Panel Members is STARTED [ONE time RUN at START]');
        // assignCandidatesToPanelMembers();
        // console.log('Assign Candidates to Panel Members is FINISHED');

        console.log('Generate QR code for candidates is STARTED [ONE time RUN at START]');
        await generateAndStoreQRCodes().then(() => console.log('Generate QR code for candidates is FINISHED'));
    });

    console.log('Scheduler initialized successfully');
};

module.exports = { initScheduler };
