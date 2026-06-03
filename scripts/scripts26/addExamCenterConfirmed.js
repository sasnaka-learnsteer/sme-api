// scripts/scripts26/addExamCenterConfirmed.js
// Migration: adds exam_center_confirmed: false to all existing sme26registrations
// that don't already have the field.
// Run: node scripts/scripts26/addExamCenterConfirmed.js

const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');

const COLLECTION = 'sme26registrations';

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(COLLECTION);

        const result = await collection.updateMany(
            { exam_center_confirmed: { $exists: false } },
            { $set: { exam_center_confirmed: false } }
        );

        console.log(`✅ Migration complete.`);
        console.log(`   Matched : ${result.matchedCount}`);
        console.log(`   Modified: ${result.modifiedCount}`);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

run();
