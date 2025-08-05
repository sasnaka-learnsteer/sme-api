const env = require('../config/env');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');

async function fetchSheetData() {
    console.log('Starting Google Sheets data fetch...');

    const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Form_Responses_1!A:Z';

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SHEET_ID,
        range,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return [];
    }

    const headers = rows[0];

    // Find the NIC column (handle spaces and case variations)
    const nicColumn = headers.find(header =>
        header && header.toString().trim().toUpperCase().includes('NIC')
    );

    console.log('Found NIC column:', `"${nicColumn}"`);

    const data = rows.slice(1).map(row => {
        let doc = {};
        headers.forEach((header, i) => {
            doc[header] = row[i] || '';
        });

        // Normalize the NIC field - copy the actual NIC column to a clean "NIC" field
        if (nicColumn && doc[nicColumn]) {
            doc.NIC = doc[nicColumn].toString().trim();
        }

        return doc;
    });

    console.log(`Processed ${data.length} data rows`);
    return data;
}

async function processDataForMongo(docs) {
    console.log('⚙️ Processing data for MongoDB...');

    if (!docs || docs.length === 0) {
        console.log('❌ No documents to process');
        return [];
    }

    // Group by NIC and keep only the last entry for each NIC
    const nicMap = new Map();
    const duplicateTracker = new Map(); // Track duplicates
    let validCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    for (const doc of docs) {
        // Check the normalized NIC field
        if (!doc.NIC || doc.NIC.toString().trim() === '') {
            skippedCount++;
            continue;
        }

        // Track if this NIC was seen before
        if (nicMap.has(doc.NIC)) {
            duplicateCount++;
            // Track duplicate NICs for reporting
            if (!duplicateTracker.has(doc.NIC)) {
                duplicateTracker.set(doc.NIC, 1);
            } else {
                duplicateTracker.set(doc.NIC, duplicateTracker.get(doc.NIC) + 1);
            }
        }

        nicMap.set(doc.NIC, doc);
        validCount++;
    }

    console.log(`✅ Valid records: ${validCount}, Skipped (no NIC): ${skippedCount}`);
    console.log(`🔄 Duplicate NICs found: ${duplicateCount} duplicates`);
    console.log(`📋 Unique NICs after deduplication: ${nicMap.size}`);

    // Show some examples of duplicate NICs
    // if (duplicateTracker.size > 0) {
    //     console.log('📝 Examples of duplicate NICs:');
    //     let count = 0;
    //     for (const [nic, occurrences] of duplicateTracker) {
    //         if (count < 5) { // Show first 5 examples
    //             console.log(`   NIC ${nic}: ${occurrences + 1} occurrences`);
    //             count++;
    //         }
    //     }
    //     if (duplicateTracker.size > 5) {
    //         console.log(`   ... and ${duplicateTracker.size - 5} more duplicate NICs`);
    //     }
    // }

    return Array.from(nicMap.values());
}

async function insertIntoMongo(docs) {
    const client = new MongoClient(env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.MONGODB_COLLECTION);

        // Process data to keep only the latest entry per NIC
        const processedDocs = await processDataForMongo(docs);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Process each document
        for (const doc of processedDocs) {
            try {
                // Skip if NIC number is missing
                if (!doc.NIC) {
                    console.log('Skipping document without NIC');
                    skippedCount++;
                    continue;
                }

                // Check if document with same NIC exists
                const existingDoc = await collection.findOne({ NIC: doc.NIC });

                if (existingDoc) {
                    // Compare if there are actual changes before updating
                    let hasChanges = false;
                    const updateDoc = {};

                    for (const [key, value] of Object.entries(doc)) {
                        if (value !== undefined && value !== null && value !== '') {
                            // Only include field if it's different from existing document
                            if (existingDoc[key] !== value) {
                                updateDoc[key] = value;
                                hasChanges = true;
                            }
                        }
                    }

                    // Only update if there are actual changes
                    if (hasChanges) {
                        const result = await collection.updateOne(
                            { NIC: doc.NIC },
                            { $set: updateDoc }
                        );
                        if (result.modifiedCount > 0) updatedCount++;
                    } else {
                        // console.log(`No changes for NIC ${doc.NIC}`);
                        skippedCount++;
                    }
                } else {
                    // Insert new document
                    await collection.insertOne(doc);
                    insertedCount++;
                }
            } catch (error) {
                console.error(`Error processing document with NIC ${doc.NIC}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`
Registration processing complete:
- Updated: ${updatedCount} documents
- Inserted: ${insertedCount} new documents
- Skipped: ${skippedCount} documents
- Errors: ${errorCount} documents
        `);
    } finally {
        await client.close();
    }
}

async function syncData() {
    console.log(`Running data sync to MONGO at ${new Date().toISOString()}`);
    try {
        const data = await fetchSheetData();
        await insertIntoMongo(data);
        console.log(`Data sync to MONGO completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('Error during data sync to MONGO:', error);
    }
}

async function cleanCollection() {
    console.log(`Starting collection cleanup at ${new Date().toISOString()}`);
    const client = new MongoClient(env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.MONGODB_COLLECTION);

        // Get all distinct NICs
        const distinctNics = await collection.distinct('NIC', { NIC: { $exists: true, $ne: '' } });
        console.log(`Found ${distinctNics.length} distinct NICs in collection`);

        let removedCount = 0;

        // For each NIC, find all documents and keep only the latest one
        for (const nic of distinctNics) {
            // Find all documents with this NIC, sorted by Timestamp (descending)
            const docs = await collection.find({ NIC: nic })
                .sort({ Timestamp: -1 })
                .toArray();

            // If more than one document exists for this NIC
            if (docs.length > 1) {
                // Keep the first one (latest by timestamp) and delete the rest
                const docsToDelete = docs.slice(1);
                const deleteIds = docsToDelete.map(doc => doc._id);

                const deleteResult = await collection.deleteMany({
                    _id: { $in: deleteIds }
                });

                removedCount += deleteResult.deletedCount;
            }
        }

        console.log(`Cleanup complete: Removed ${removedCount} duplicate documents`);
    } catch (error) {
        console.error('Error during collection cleanup:', error);
    } finally {
        await client.close();
    }
}

module.exports = { syncData, cleanCollection };