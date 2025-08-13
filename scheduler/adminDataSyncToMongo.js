const env = require('../config/env');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { updateAdminPanelIds } = require('../scripts/updateAdminPanelIds');

async function fetchAdminSheetData() {
    console.log('Starting Admin data fetch from Gsheet...');

    const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Form_Responses_1!A:Z';

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.ADMIN_SHEET_ID,
        range,
    });

    const resFormat = await sheets.spreadsheets.get({
        spreadsheetId: env.ADMIN_SHEET_ID,
        ranges: [range],
        fields: 'sheets.data.rowData.values.effectiveFormat',
    });
    const formatData = resFormat.data.sheets[0].data[0].rowData;

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return [];
    }

    const headers = rows[0];

    // Find Whatsapp column index
    const wpColIndex = headers.findIndex(header =>
        header && header.toString().trim().toUpperCase().includes('WHATSAPP')
    );

    console.log('Found Whatsapp number column:', `"${headers[wpColIndex]}"`);

    const data = rows.slice(1).map((row, i) => {
        let doc = {};
        headers.forEach((header, idx) => {
            doc[header] = row[idx] || '';
        });

        // Normalize the WPNumber field - copy the actual WPNumber column to a clean "WPNumber" field
        if (wpColIndex !== -1 && row[wpColIndex]) {
            doc.WPNumber = row[wpColIndex].toString().trim();

            // Check if Whatsapp cell is highlighted
            const cellFormat = formatData[i + 1]?.values[wpColIndex]?.effectiveFormat;
            const bgColor = cellFormat?.backgroundColor;
            if (
                bgColor &&
                bgColor.blue > 0.7 && // blue channel is dominant
                (bgColor.red < 0.5 || bgColor.green < 0.7) // red/green are not dominant
            ) {
                // doc.IsAMentor = true;
            }
        }

        return doc;
    });

    const mentorCount = data.filter(doc => doc.IsAMentor === true).length;
    console.log(`Docs marked as IsAMentor: ${mentorCount}`);

    console.log(`Processed ${data.length} data rows`);
    return data;
}

async function processAdminDataForMongo(docs) {
    console.log('⚙️ Processing data for MongoDB...');

    if (!docs || docs.length === 0) {
        console.log('❌ No documents to process');
        return [];
    }

    // Group by WPNumber and keep only the last entry for each WPNumber
    const wpnumberMap = new Map();
    const duplicateTracker = new Map(); // Track duplicates
    let validCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    for (const doc of docs) {
        // Check the normalized WPNumber field
        if (!doc.WPNumber || doc.WPNumber.toString().trim() === '') {
            skippedCount++;
            continue;
        }

        // Track if this WPNumber was seen before
        if (wpnumberMap.has(doc.WPNumber)) {
            duplicateCount++;
            // Track duplicate WPNumbers for reporting
            if (!duplicateTracker.has(doc.WPNumber)) {
                duplicateTracker.set(doc.WPNumber, 1);
            } else {
                duplicateTracker.set(doc.WPNumber, duplicateTracker.get(doc.WPNumber) + 1);
            }
        }

        wpnumberMap.set(doc.WPNumber, doc);
        validCount++;
    }

    console.log(`✅ Valid records: ${validCount}, Skipped (no WPNumber): ${skippedCount}`);
    console.log(`🔄 Duplicate WPNumbers found: ${duplicateCount} duplicates`);
    console.log(`📋 Unique WPNumbers after deduplication: ${wpnumberMap.size}`);

    return Array.from(wpnumberMap.values());
}

function getProvinceByDistrict(district) {
    const mapping = {
        Western: ['Colombo', 'Gampaha', 'Kalutara'],
        Central: ['Matale', 'Kandy', 'Nuwara Eliya'],
        Southern: ['Galle', 'Matara', 'Hambantota'],
    };

    const cleanDistrict = (district || '').toLowerCase().trim();

    for (const [province, districts] of Object.entries(mapping)) {
        if (districts.map(d => d.toLowerCase().trim()).includes(cleanDistrict)) {
            return province;
        }
    }
    return '';
}

async function insertAdminIntoMongo(docs) {
    const client = new MongoClient(env.MONGODB_URI);
    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

        // Process data to keep only the latest entry per WPNumber
        const processedDocs = await processAdminDataForMongo(docs);

        // Process each document
        for (const doc of processedDocs) {
            try {
                if (!doc.WPNumber) {
                    skippedCount++;
                    continue;
                }

                // Map district to province and add Province key
                doc.Province = getProvinceByDistrict(doc.District);

                // Check if document with same WPNumber exists
                const existingDoc = await collection.findOne({ WPNumber: doc.WPNumber });

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
                        await collection.updateOne(
                            {WPNumber: doc.WPNumber},
                            {$set: updateDoc}
                        );
                        updatedCount++;
                    }
                } else {
                    // Insert new document
                    await collection.insertOne(doc);
                    insertedCount++;
                }
            } catch (error) {
                errorCount++;
                console.error(`Error processing document with WPNumber ${doc.WPNumber}: ${error.message}`);
            }
        }
        console.log(`
Admin Data >> Registration processing complete:
- Updated: ${updatedCount} documents
- Inserted: ${insertedCount} new documents
- Skipped: ${skippedCount} documents
- Errors: ${errorCount} documents
        `);

        console.log(`ADMIN Registration processing complete:`);
    } finally {
        await client.close();
    }
}

async function syncAdminData() {
    console.log(`Running ADMIN data sync to MONGO at ${new Date().toISOString()}`);
    try {
        const data = await fetchAdminSheetData();
        await insertAdminIntoMongo(data);
        console.log(`ADMIN Data sync to MONGO completed at ${new Date().toISOString()}`);

        // Run panel ID update script after sync
        await updateAdminPanelIds();
        console.log('Panel IDs updated for admins.');
    } catch (error) {
        console.error('Error during ADMIN data sync to MONGO:', error);
    }
}

async function cleanAdminCollection() {
    console.log(`Starting adminpanel collection cleanup at ${new Date().toISOString()}`);
    const client = new MongoClient(env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

        // Get all distinct WPNumbers
        const distinctWPNumbers = await collection.distinct('WPNumber', { WPNumber: { $exists: true, $ne: '' } });
        console.log(`[adminpanel collection cleanup] Found ${distinctWPNumbers.length} distinct WPNumbers in collection`);

        let removedCount = 0;

        // For each WPNumber, find all documents and keep only the latest one
        for (const wpnumber of distinctWPNumbers) {
            // Find all documents with this WPNumber, sorted by Timestamp (descending)
            const docs = await collection.find({ WPNumber: wpnumber })
                .sort({ Timestamp: -1 })
                .toArray();

            // If more than one document exists for this WPNumber
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

        console.log(`[adminpanel] Cleanup complete: Removed ${removedCount} duplicate documents`);
    } catch (error) {
        console.error('Error during adminpanel collection cleanup:', error);
    } finally {
        await client.close();
    }
}

module.exports = { syncAdminData, cleanAdminCollection, getProvinceByDistrict };