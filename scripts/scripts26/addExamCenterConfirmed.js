// scripts/scripts26/addExamCenterConfirmed.js
// Migration: adds exam_center_confirmed: false to all existing sme26registrations
// that don't already have the field.
// Run: node scripts/scripts26/addExamCenterConfirmed.js

const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');

const COLLECTIONS = ['sme25registrations', 'sme26registrations'];

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);

        for (const collName of COLLECTIONS) {
            console.log(`\nProcessing collection: ${collName}`);
            const collection = db.collection(collName);

            // 1. Rename existing 'exam_center_confirmed' to 'exam_center_confirmed26'
            const renameResult = await collection.updateMany(
                { exam_center_confirmed: { $exists: true } },
                { $rename: { exam_center_confirmed: 'exam_center_confirmed26' } }
            );
            console.log(`   Renamed existing keys: ${renameResult.modifiedCount}`);

            // 2. Set 'exam_center_confirmed26: false' for any docs missing it
            const setResult = await collection.updateMany(
                { exam_center_confirmed26: { $exists: false } },
                { $set: { exam_center_confirmed26: false } }
            );
            console.log(`   Added missing keys defaults: ${setResult.modifiedCount}`);
        }

        console.log(`\n✅ Migration complete for both collections.`);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

run();
