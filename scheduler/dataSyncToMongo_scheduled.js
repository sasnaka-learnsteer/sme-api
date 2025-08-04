require('dotenv').config();
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');

async function fetchSheetData() {
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Form_Responses_1!A:Z';

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return [];
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
        let doc = {};
        headers.forEach((header, i) => {
            doc[header] = row[i] || '';
        });
        return doc;
    });

    return data;
}

async function processDataForMongo(docs) {
    // Group by NIC and keep only the last entry for each NIC
    const nicMap = new Map();

    for (const doc of docs) {
        if (!doc.NIC) continue;
        nicMap.set(doc.NIC, doc);
    }

    return Array.from(nicMap.values());
}

async function insertIntoMongo(docs) {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        const collection = db.collection(process.env.MONGODB_COLLECTION);

        // Process data to keep only the latest entry per NIC
        const processedDocs = await processDataForMongo(docs);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // // Check if collection is empty
        // const count = await collection.countDocuments({}, { limit: 1 });
        //
        // if (count === 0 && docs.length > 0) {
        //     // Collection is empty, perform bulk insert
        //     const validDocs = docs.filter(doc => doc.NIC);
        //     if (validDocs.length > 0) {
        //         const result = await collection.insertMany(validDocs);
        //         console.log(`Inserted ${result.insertedCount} documents into empty collection.`);
        //     } else {
        //         console.log('No valid documents to insert into empty collection.');
        //     }
        //     return;
        // }

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
                    // Create a clean update object (remove empty fields and undefined values)
                    const updateDoc = {};
                    for (const [key, value] of Object.entries(doc)) {
                        if (value !== undefined && value !== null && value !== '') {
                            updateDoc[key] = value;
                        }
                    }

                    // Only update if there are fields to update
                    if (Object.keys(updateDoc).length > 0) {
                        const result = await collection.updateOne(
                            { NIC: doc.NIC },
                            { $set: updateDoc }
                        );
                        if (result.modifiedCount > 0) updatedCount++;
                    } else {
                        console.log(`No changes for NIC ${doc.NIC}`);
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

module.exports = { syncData };