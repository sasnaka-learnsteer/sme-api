const env = require('../config/env');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { getProvinceByDistrict } = require("../scheduler/adminDataSyncToMongo");

async function fetchSheetData() {
    console.log('Starting Candidates data fetch from Candidate Outreach team - GSheet...');

    const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'candidates_with_no_assignment!A:Z';

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.SHEET_ID_CO_TEAM,
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

    console.log(`[CO team : Candidates data fetch] Processed ${data.length} data rows`);
    return data;
}

async function processDataForMongo(docs) {
    console.log('⚙️[CO team : Candidates data fetch] Processing data for MongoDB...');

    if (!docs || docs.length === 0) {
        console.log('❌[CO team : Candidates data fetch] No documents to process');
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

    console.log(`✅[CO team : Candidates] Valid records: ${validCount}, Skipped (no NIC): ${skippedCount}`);
    console.log(`🔄[CO team : Candidates] Duplicate NICs found: ${duplicateCount} duplicates`);
    console.log(`📋[CO team : Candidates] Unique NICs after deduplication: ${nicMap.size}`);

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

                // Map district to province and add Province key
                doc.Province = getProvinceByDistrict(doc.District);

                // Transform data according to business rules
                transformDocumentData(doc);

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
COTeam Data >> Registration processing complete:
- Updated: ${updatedCount} documents
- Inserted: ${insertedCount} new documents
- Skipped: ${skippedCount} documents
- Errors: ${errorCount} documents
        `);
    } finally {
        await client.close();
    }
}

function transformDocumentData(doc) {
    // List of columns to skip
    const columnsToSkip = [
        '_id', 'Timestamp', 'Full Name',
        'School', 'AL Batch', 'Email Address',
        'Preferred Exam Center', 'Whatsapp Number'
    ];

    // Remove skipped columns from the document
    columnsToSkip.forEach(column => {
        delete doc[column];
    });

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

async function syncCOTeamData() {
    console.log(`Running candidates data sync From COTeam sheet to MONGO at ${new Date().toISOString()}`);
    try {
        const data = await fetchSheetData();
        await insertIntoMongo(data);
        console.log(`candidates data sync From COTeam sheet to MONGO completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('Error during data sync From COTeam sheet to MONGO:', error);
    }
}

module.exports = { syncCOTeamData };