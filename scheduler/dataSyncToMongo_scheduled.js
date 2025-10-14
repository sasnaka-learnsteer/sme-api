const env = require('../config/env');
const { google } = require('googleapis');
const mongoPool = require('../services/mongoConnectionPool');
const { getProvinceByDistrict } = require("../scheduler/adminDataSyncToMongo");

// Cache to avoid unnecessary API calls
let sheetsDataCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache for sheets data

async function fetchSheetData() {
    console.log('Starting Candidates data fetch from multiple GSheets...');

    const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Form_Responses_2!A:Z';

    // List of spreadsheet IDs to fetch data from
    const spreadsheetIds = [
        // env.SHEET_ID,
        // env.SHEET_ID_AMPARA,
        env.SHEET_ID_MATARA
    ];

    let allData = []
    for (const spreadsheetId of spreadsheetIds) {
        try {
            // Check cache first
            const cacheKey = `${spreadsheetId}-${range}`;
            const cachedData = sheetsDataCache.get(cacheKey);

            if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
                console.log(`Using cached data for spreadsheet: ${spreadsheetId}`);
                allData = [...allData, ...cachedData.data];
                continue;
            }

            console.log(`Fetching fresh data from spreadsheet: ${spreadsheetId}`);

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = res.data.values;
            if (!rows || rows.length === 0) {
                console.log(`No data found in spreadsheet: ${spreadsheetId}`);
                continue;
            }

            const headers = rows[0];

            // Find the NIC column (handle spaces and case variations)
            const nicColumn = headers.find(header =>
                header && header.toString().trim().toUpperCase().includes('NIC')
            );

            console.log(`Found NIC column in spreadsheet ${spreadsheetId}: "${nicColumn}"`);

            // Process data from this sheet
            const sheetData = rows.slice(1).map(row => {
                let doc = {};
                headers.forEach((header, i) => {
                    doc[header] = row[i] || '';
                });

                // Normalize the NIC field
                if (nicColumn && doc[nicColumn]) {
                    doc.NIC = doc[nicColumn].toString().trim();
                }

                // Add source spreadsheet ID for tracking
                doc.sourceSheet = spreadsheetId;

                return doc;
            });

            // Cache the processed data
            sheetsDataCache.set(cacheKey, {
                data: sheetData,
                timestamp: Date.now()
            });

            console.log(`Processed ${sheetData.length} rows from spreadsheet: ${spreadsheetId}`);
            allData = [...allData, ...sheetData];
        }catch (error) {
            console.error(`Error fetching data from spreadsheet ${spreadsheetId}:`, error.message);
        }
    }

    console.log(`[Candidates data fetch] Total rows processed across all sheets: ${allData.length}`);
    return allData;
}

async function processDataForMongo(docs) {
    console.log('⚙️[Candidates data fetch] Processing data for MongoDB...');

    if (!docs || docs.length === 0) {
        console.log('❌[Candidates data fetch] No documents to process');
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

    console.log(`✅[Candidates] Valid records: ${validCount}, Skipped (no NIC): ${skippedCount}`);
    console.log(`🔄[Candidates] Duplicate NICs found: ${duplicateCount} duplicates`);
    console.log(`📋[Candidates] Unique NICs after deduplication: ${nicMap.size}`);

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
    try {
        // Use connection pool instead of creating new connections
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        // Process data to keep only the latest entry per NIC
        const processedDocs = await processDataForMongo(docs);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Use bulk operations for better performance and reduced connection overhead
        const bulkOps = [];
        const batchSize = 100; // Process in smaller batches to reduce memory usage

        for (let i = 0; i < processedDocs.length; i += batchSize) {
            const batch = processedDocs.slice(i, i + batchSize);

            for (const doc of batch) {
                try {
                    // Skip if NIC number is missing
                    if (!doc.NIC) {
                        skippedCount++;
                        continue;
                    }

                    // Map district to province and add Province key
                    doc.Province = getProvinceByDistrict(doc.District);

                    // Transform data according to business rules
                    transformDocumentDataAmpara(doc);

                    // Use upsert operation for efficiency
                    bulkOps.push({
                        updateOne: {
                            filter: { NIC: doc.NIC },
                            update: { $set: doc },
                            upsert: true
                        }
                    });

                } catch (error) {
                    console.error(`Error processing document with NIC ${doc.NIC}:`, error.message);
                    errorCount++;
                }
            }

            // Execute bulk operations for this batch
            if (bulkOps.length > 0) {
                try {
                    const result = await collection.bulkWrite(bulkOps, { ordered: false });
                    insertedCount += result.upsertedCount;
                    updatedCount += result.modifiedCount;

                    // Clear bulk ops for next batch
                    bulkOps.length = 0;
                } catch (bulkError) {
                    console.error('Bulk operation error:', bulkError.message);
                    errorCount += bulkOps.length;
                }
            }
        }

        console.log(`✅[Candidates] MongoDB sync completed:`);
        console.log(`   📝 Inserted: ${insertedCount}`);
        console.log(`   🔄 Updated: ${updatedCount}`);
        console.log(`   ⏭️ Skipped: ${skippedCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);

        return {
            inserted: insertedCount,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount
        };
    } catch (error) {
        console.error('❌[Candidates] Error in insertIntoMongo:', error.message);
        throw error;
    }
}

async function syncData() {
    console.log(`Running candidates data sync to MONGO at ${new Date().toISOString()}`);
    try {
        const data = await fetchSheetData();
        await insertIntoMongo(data);
        console.log(`candidates data sync to MONGO completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('Error during data sync to MONGO:', error);
    }
}

async function cleanCollection() {
    console.log(`Starting registrations collection cleanup at ${new Date().toISOString()}`);

    try {
        // Use connection pool instead of creating new connection
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        // Get all distinct NICs
        const distinctNics = await collection.distinct('NIC', { NIC: { $exists: true, $ne: '' } });
        console.log(`[registrations collection cleanup] Found ${distinctNics.length} distinct NICs in collection`);

        let removedCount = 0;

        // Process in batches to avoid memory issues with large datasets
        const batchSize = 100;
        for (let i = 0; i < distinctNics.length; i += batchSize) {
            const nicBatch = distinctNics.slice(i, i + batchSize);

            // Use aggregation to find duplicates more efficiently
            const duplicates = await collection.aggregate([
                {
                    $match: {
                        NIC: { $in: nicBatch }
                    }
                },
                {
                    $sort: { NIC: 1, Timestamp: -1 }
                },
                {
                    $group: {
                        _id: '$NIC',
                        docs: { $push: { id: '$_id', timestamp: '$Timestamp' } },
                        count: { $sum: 1 }
                    }
                },
                {
                    $match: { count: { $gt: 1 } }
                }
            ]).toArray();

            // Collect IDs to delete (keep the first, delete the rest)
            const idsToDelete = [];
            duplicates.forEach(nic => {
                const docsToDelete = nic.docs.slice(1); // Skip first (latest) document
                idsToDelete.push(...docsToDelete.map(doc => doc.id));
            });

            // Delete duplicates in bulk
            if (idsToDelete.length > 0) {
                const deleteResult = await collection.deleteMany({
                    _id: { $in: idsToDelete }
                });
                removedCount += deleteResult.deletedCount;
                console.log(`Processed batch ${Math.floor(i/batchSize) + 1}: removed ${deleteResult.deletedCount} duplicates`);
            }
        }

        console.log(`[registrations] Cleanup complete: Removed ${removedCount} duplicate documents`);
    } catch (error) {
        console.error('Error during registrations collection cleanup:', error);
        throw error;
    }
}

function transformDocumentDataAmpara(doc) {

    // Map Subject Stream directly
    if (doc['Subject Stream']) {
        doc['Subject Stream'] = doc['Subject Stream'];
    }

    // Map Attending Status to participation_status
    if (doc['Attending Status']) {
        const attendingStatus = doc['Attending Status'].trim();
        if (attendingStatus === 'Attending') {
            doc['participation_status'] = 'confirmed';
        } else if (attendingStatus === 'Not Attending') {
            doc['participation_status'] = 'rejected';
        }
        delete doc['Attending Status'];
    }

    // Map Contact Status to participation_status (overrides attending status if unable to contact)
    if (doc['Contact Status']) {
        const contactStatus = doc['Contact Status'].trim();
        if (contactStatus === 'Unable to Contact') {
            doc['participation_status'] = 'not_reachable';
        }
        delete doc['Contact Status'];
    }

    // Initialize confirmed_papers array
    doc['confirmed_papers'] =  doc['confirmed_papers'] || [];

    // Add papers based on subject preferences
    if (doc['Biology'] && doc['Biology'].trim().toLowerCase() === 'yes') {
        doc['confirmed_papers'].push('Biology I', 'Biology II');
    }
    delete doc['Biology'];

    if (doc['Combined Maths'] && doc['Combined Maths'].trim().toLowerCase() === 'yes') {
        doc['confirmed_papers'].push('Combined Maths I', 'Combined Maths II');
    }
    delete doc['Combined Maths'];

    if (doc['Physics'] && doc['Physics'].trim().toLowerCase() === 'yes') {
        doc['confirmed_papers'].push('Physics I', 'Physics II');
    }
    delete doc['Physics'];

    if (doc['Chemistry'] && doc['Chemistry'].trim().toLowerCase() === 'yes') {
        doc['confirmed_papers'].push('Chemistry I', 'Chemistry II');
    }
    delete doc['Chemistry'];

    // Remove duplicates from confirmed_papers array
    doc['confirmed_papers'] = [...new Set(doc['confirmed_papers'])];
}

module.exports = { syncData, cleanCollection };