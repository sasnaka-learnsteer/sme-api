// scripts/insertIndexNumberInventory.js
// Seeds the indexnumbers_inventory collection with 500 index numbers per exam center (3000 total).
//
// Index number format: 7 digits
//   Digit 1 : Center digit (from center_id, e.g. EC-SME26-001 → 1)
//   Digit 2 : Stream digit (0=Bio Science, 1=Physical Science, 2=Non Stream, 3=Other Stream)
//   Digits 3-7 : 5-digit random unique suffix (00000–99999), zero-padded
//
// Run: node scripts/scripts26/insertIndexNumberInventory.js

const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');

const INVENTORY_COLLECTION = 'sme26indexnumbers';
const EXAM_YEAR = 'sme26';
const PER_CENTER_PER_STREAM = 125; // 125 × 4 streams × 6 centers = 3000 total

/**
 * Generates PER_CENTER_PER_STREAM unique random 5-digit suffixes (00000–99999)
 * for a given center+stream combination, seeded by center+stream to avoid global collisions.
 */
function generateUniqueSuffixes(count) {
    const suffixes = new Set();
    while (suffixes.size < count) {
        const n = Math.floor(Math.random() * 100000);
        suffixes.add(String(n).padStart(5, '0'));
    }
    return Array.from(suffixes);
}

async function insertIndexNumberInventory() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(INVENTORY_COLLECTION);

        // --- Load centers from sme26examcenters ---
        const centerDocs = await db.collection('sme26examcenters')
            .find({ is_active: true }, { projection: { center_id: 1, center_name: 1 } })
            .sort({ center_id: 1 })
            .toArray();

        if (centerDocs.length === 0) {
            console.error('❌ No active centers found in sme26examcenters. Run insertExamCenters.js first.');
            process.exit(1);
        }

        // Derive center_digit from the trailing number in center_id (e.g. 'EC-SME26-001' → 1)
        const centers = centerDocs.map(c => ({
            center_id: c.center_id,
            center_name: c.center_name,
            center_digit: parseInt(c.center_id.split('-').pop(), 10)
        }));

        console.log(`✔ Loaded ${centers.length} center(s) from sme26examcenters`);

        // --- Load streams from sme26streams ---
        const streamDocs = await db.collection('sme26streams')
            .find({ is_active: true }, { projection: { stream_digit: 1, stream_name: 1 } })
            .sort({ stream_digit: 1 })
            .toArray();

        if (streamDocs.length === 0) {
            console.error('❌ No active streams found in sme26streams. Run insertStreams.js first.');
            process.exit(1);
        }

        const streams = streamDocs.map(s => ({
            stream_digit: s.stream_digit,
            stream_name: s.stream_name
        }));

        console.log(`✔ Loaded ${streams.length} stream(s) from sme26streams`);

        // Ensure indexes exist (idempotent)
        await collection.createIndex({ index_number: 1 }, { unique: true });
        await collection.createIndex({ center_id: 1 });
        await collection.createIndex({ exam_year: 1 });
        await collection.createIndex({ is_assigned: 1 });

        // Find which centers already have inventory
        const existingCenterIds = await collection.distinct('center_id');
        const newCenters = centers.filter(c => !existingCenterIds.includes(c.center_id));

        if (newCenters.length === 0) {
            console.log(`⚠️  All ${centers.length} center(s) already have index numbers in "${INVENTORY_COLLECTION}". Nothing to insert.`);
            return;
        }

        console.log(`✔ Found ${newCenters.length} new center(s) needing index numbers:`);
        newCenters.forEach(c => console.log(`   - ${c.center_name} (${c.center_id})`));
        if (existingCenterIds.length > 0) {
            console.log(`   (${existingCenterIds.length} center(s) already have inventory — skipped)`);
        }

        // Load existing index numbers to avoid collisions
        const existingNumbers = new Set(
            (await collection.find({}, { projection: { index_number: 1 } }).toArray())
                .map(d => d.index_number)
        );
        const allDocs = [];

        for (const center of newCenters) {
            for (const stream of streams) {
                const prefix = `${center.center_digit}${stream.stream_digit}`;
                let generated = 0;

                while (generated < PER_CENTER_PER_STREAM) {
                    const suffix = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
                    const indexNumber = `${prefix}${suffix}`;

                    if (!existingNumbers.has(indexNumber)) {
                        existingNumbers.add(indexNumber);
                        allDocs.push({
                            index_number: indexNumber,
                            exam_year: EXAM_YEAR,
                            center_id: center.center_id,
                            center_name: center.center_name,
                            stream_digit: stream.stream_digit,
                            stream_name: stream.stream_name,
                            is_assigned: false,
                            status: 'available',   // 'available' | 'assigned' | 'reserved'
                            assigned_to: null,     // NIC of candidate when assigned
                            assigned_at: null,
                            created_at: new Date()
                        });
                        generated++;
                    }
                }
            }

            console.log(`   ✔ Generated ${PER_CENTER_PER_STREAM * streams.length} numbers for ${center.center_name}`);
        }

        // Insert in batches of 500
        const BATCH_SIZE = 500;
        let inserted = 0;
        for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
            const batch = allDocs.slice(i, i + BATCH_SIZE);
            await collection.insertMany(batch, { ordered: false });
            inserted += batch.length;
        }

        console.log(`\n✅ Done! Inserted ${inserted} index number documents into "${INVENTORY_COLLECTION}".`);
        console.log(`   Format: [center_digit][stream_digit][5-digit-random]`);
        console.log(`   Exam year: ${EXAM_YEAR}`);
        console.log(`   New centers processed: ${newCenters.length}`);
        console.log(`   Per center: ${PER_CENTER_PER_STREAM * streams.length} (${PER_CENTER_PER_STREAM} × ${streams.length} streams)`);
        console.log(`   Total new: ${inserted}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

insertIndexNumberInventory();
