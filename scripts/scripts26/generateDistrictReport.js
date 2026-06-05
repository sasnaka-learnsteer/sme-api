// scripts/scripts26/generateDistrictReport.js
// Generates a report of registration counts categorized by District
// and separated by exam center confirmation status.
// Run: node scripts/scripts26/generateDistrictReport.js

require('../../config/env');
const { MongoClient } = require('mongodb');

// MongoDB connection details
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const COLLECTION_NAME = 'sme26registrations';

async function generateDistrictReport() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(COLLECTION_NAME);

        console.log(`Analyzing ${COLLECTION_NAME} collection...\n`);

        const pipeline = [
            {
                $group: {
                    _id: { $ifNull: ['$District', 'Not Specified'] },
                    confirmed: {
                        $sum: {
                            $cond: [{ $eq: ['$exam_center_confirmed26', true] }, 1, 0]
                        }
                    },
                    unconfirmed: {
                        $sum: {
                            $cond: [{ $ne: ['$exam_center_confirmed26', true] }, 1, 0]
                        }
                    },
                    total: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort alphabetically by District
            }
        ];

        const results = await collection.aggregate(pipeline).toArray();

        if (results.length === 0) {
            console.log('No data found.');
            return;
        }

        // Print table header
        console.log(
            'District'.padEnd(25) +
            'Confirmed'.padStart(15) +
            'Unconfirmed'.padStart(15) +
            'Total'.padStart(15)
        );
        console.log('-'.repeat(70));

        let totalConfirmed = 0;
        let totalUnconfirmed = 0;
        let grandTotal = 0;

        for (const row of results) {
            const district = String(row._id).padEnd(25);
            const confirmed = String(row.confirmed).padStart(15);
            const unconfirmed = String(row.unconfirmed).padStart(15);
            const total = String(row.total).padStart(15);

            console.log(`${district}${confirmed}${unconfirmed}${total}`);

            totalConfirmed += row.confirmed;
            totalUnconfirmed += row.unconfirmed;
            grandTotal += row.total;
        }

        // Print table footer
        console.log('-'.repeat(70));
        console.log(
            'GRAND TOTAL'.padEnd(25) +
            String(totalConfirmed).padStart(15) +
            String(totalUnconfirmed).padStart(15) +
            String(grandTotal).padStart(15)
        );
        console.log('-'.repeat(70) + '\n');

    } catch (error) {
        console.error('Error generating report:', error);
    } finally {
        await client.close();
    }
}

generateDistrictReport();
