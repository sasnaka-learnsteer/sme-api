require('./config/env');
const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        const collection = db.collection('sme26indexnumbers');
        
        const assigned = await collection.find({ is_assigned: true }).sort({ assigned_at: 1 }).toArray();
        
        console.log(`Total assigned: ${assigned.length}`);
        
        const byCenter = {};
        for (const doc of assigned) {
            if (!byCenter[doc.center_name]) byCenter[doc.center_name] = [];
            byCenter[doc.center_name].push(doc);
        }
        
        for (const [center, docs] of Object.entries(byCenter)) {
            console.log(`\nCenter: ${center} (${docs.length} assigned)`);
            const displayDocs = docs.length <= 10 ? docs : [...docs.slice(0, 5), { index_number: '...' }, ...docs.slice(-5)];
            for (const doc of displayDocs) {
                if (doc.index_number === '...') {
                    console.log('  ...');
                } else {
                    console.log(`  Index: ${doc.index_number}, Stream: ${doc.stream_name}, Assigned At: ${doc.assigned_at}`);
                }
            }
        }
    } finally {
        await client.close();
    }
}
run().catch(console.error);
