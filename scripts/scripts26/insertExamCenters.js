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
        center_location: 'D.S.Senanayaka National School',
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
        center_location: 'Sri Sumangala Balika Maha Vidyalaya',
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
    }
];

async function insertExamCenters() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(EXAM_CENTERS_COLLECTION);

        // Prevent duplicate inserts
        const existing = await collection.countDocuments();
        if (existing > 0) {
            console.log(`⚠️  Collection "${EXAM_CENTERS_COLLECTION}" already has ${existing} document(s). Skipping insert.`);
            console.log('   Drop the collection first if you want to re-seed.');
            return;
        }

        // Create a unique index on center_id
        await collection.createIndex({ center_id: 1 }, { unique: true });

        const result = await collection.insertMany(examCenters);
        console.log(`✅ Inserted ${result.insertedCount} exam center(s) into "${EXAM_CENTERS_COLLECTION}":`);
        examCenters.forEach(c => console.log(`   [${c.center_id}] ${c.center_name}`));
    } catch (error) {
        console.error('❌ Error inserting exam centers:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

insertExamCenters();
