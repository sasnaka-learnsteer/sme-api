// scripts/insertStreams.js
// Seeds the sme26streams collection with 4 stream documents.
// Run: node scripts/insertStreams.js

const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');

const STREAMS_COLLECTION = 'sme26streams';

const streams = [
    {
        stream_id: 'STR-SME26-0',
        stream_digit: 0,
        stream_name: 'Bio Science',
        slug: 'bio-science',
        is_active: true,
        created_at: new Date()
    },
    {
        stream_id: 'STR-SME26-1',
        stream_digit: 1,
        stream_name: 'Physical Science',
        slug: 'physical-science',
        is_active: true,
        created_at: new Date()
    },
    {
        stream_id: 'STR-SME26-2',
        stream_digit: 2,
        stream_name: 'Non Stream (Combined Maths + ICT)',
        slug: 'non-stream-combined-maths-ict',
        is_active: true,
        created_at: new Date()
    },
    {
        stream_id: 'STR-SME26-3',
        stream_digit: 3,
        stream_name: 'Other Stream (ICT only)',
        slug: 'other-stream-ict-only',
        is_active: true,
        created_at: new Date()
    }
];

async function insertStreams() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(STREAMS_COLLECTION);

        const existing = await collection.countDocuments();
        if (existing > 0) {
            console.log(`⚠️  Collection "${STREAMS_COLLECTION}" already has ${existing} document(s). Skipping insert.`);
            return;
        }

        await collection.createIndex({ stream_id: 1 }, { unique: true });
        await collection.createIndex({ stream_digit: 1 }, { unique: true });

        const result = await collection.insertMany(streams);
        console.log(`✅ Inserted ${result.insertedCount} stream(s) into "${STREAMS_COLLECTION}":`);
        streams.forEach(s => console.log(`   [${s.stream_digit}] ${s.stream_name}`));
    } catch (error) {
        console.error('❌ Error inserting streams:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

insertStreams();
