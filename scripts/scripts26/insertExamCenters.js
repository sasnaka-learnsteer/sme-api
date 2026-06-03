// scripts/insertExamCenters.js
// Seeds the sme26examcenters collection with 6 exam center documents.
// Run: node scripts/insertExamCenters.js

const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');

const EXAM_CENTERS_COLLECTION = 'sme26examcenters';

const examCenters = [
    {
        center_id: 'EC-SME26-001',
        center_name: 'Ampara',
        slug: 'ampara',
        center_location: 'D.S.Senanayaka National School, Ampara',
        center_location_url: 'https://maps.app.goo.gl/6RwUJ25w51bvZa51A',
        center_location_address: 'D.S.Senanayaka National School, Dharmapala Mawatha, Ampara',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-002',
        center_name: 'Colombo-Malabe',
        slug: 'colombo-malabe',
        center_location: 'SLIIT Malabe Campus',
        center_location_url: 'https://maps.app.goo.gl/UvAKfJQcDtgK4VMh8',
        center_location_address: 'SLIIT Malabe Campus, New Kandy Rd, Malabe 10115',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-003',
        center_name: 'Colombo-Colpetty',
        slug: 'colombo-colpetty',
        center_location: 'SLIIT Metropolitan Campus',
        center_location_url: 'https://maps.app.goo.gl/sQWnHWqVwzJhKmwr5',
        center_location_address: 'SLIIT Metropolitan Campus 16th Floor, BOC Merchant Tower, 28 St Michaels Rd, Colombo 00300',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-004',
        center_name: 'Kalutara',
        slug: 'kalutara',
        center_location: 'Sri Sumangala Balika Maha Vidyalaya, Panadura',
        center_location_url: 'https://maps.app.goo.gl/yh4e4Yg81d969MtQ8',
        center_location_address: 'Sri Sumangala Balika Maha Vidyalaya, Panadura.',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-005',
        center_name: 'Kandy-Peradeniya',
        slug: 'kandy-peradeniya',
        center_location: 'SLIIT Kandy Center',
        center_location_url: 'https://maps.app.goo.gl/z8Cc3rrw2SsaeHQa7',
        center_location_address: '670/1/1A Peradeniya Rd, Peradeniya 20000',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-006',
        center_name: 'Matara',
        slug: 'matara',
        center_location: 'SLIIT Matara Center',
        center_location_url: 'https://maps.app.goo.gl/iYSkwU32TFvrjjnm9',
        center_location_address: 'EH Cooray Building, No.24: 5th Floor, E.H.Cooray Tower, B535, Matara',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-007',
        center_name: 'Kurunegala',
        slug: 'kurunegala',
        center_location: 'SLIIT Kurunegala Center',
        center_location_url: 'https://maps.app.goo.gl/c9tf7GWdmovcB1My9',
        center_location_address: '8 Dambulla Rd, Kurunegala',
        is_active: true,
        created_at: new Date()
    },
    {
        center_id: 'EC-SME26-008',
        center_name: 'Ratnapura',
        slug: 'ratnapura',
        center_location: 'Sivali Central College, Ratnapura',
        center_location_url: 'https://maps.app.goo.gl/6uX4u9saqk9pzuwVA',
        center_location_address: 'Sivali Central Collage, 70000 A4, Ratnapura 70000',
        is_active: true,
        created_at: new Date()
    }
];

async function insertExamCenters() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(EXAM_CENTERS_COLLECTION);

        // Create a unique index on center_id
        await collection.createIndex({ center_id: 1 }, { unique: true });

        // Prepare bulk operations for upsert
        const bulkOps = examCenters.map(center => {
            const { created_at, center_id, ...updateFields } = center;
            return {
                updateOne: {
                    filter: { center_id },
                    update: {
                        $set: updateFields,
                        $setOnInsert: { center_id, created_at: new Date() }
                    },
                    upsert: true
                }
            };
        });

        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            console.log(`✅ Exam centers sync complete:`);
            console.log(`   - Inserted new centers: ${result.upsertedCount}`);
            console.log(`   - Updated existing centers: ${result.modifiedCount}`);
            console.log(`   - Unchanged centers: ${result.matchedCount - result.modifiedCount}`);
        } else {
            console.log('No exam centers to process.');
        }
    } catch (error) {
        console.error('❌ Error inserting/updating exam centers:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

insertExamCenters();
