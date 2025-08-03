require('dotenv').config();
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');

async function fetchSheetData() {
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Form_Responses_1!A:Z'; // adjust to your sheet range

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
    return rows.slice(1).map(row => {
        let doc = {};
        headers.forEach((header, i) => {
            doc[header] = row[i] || '';
        });
        return doc;
    });
}

async function insertIntoMongo(docs) {
    if (docs.length === 0) return;
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(process.env.MONGODB_COLLECTION);
    await collection.insertMany(docs);
    await client.close();
}

exports.handler = async () => {
    try {
        const data = await fetchSheetData();
        await insertIntoMongo(data);
        console.log(`Inserted ${data.length} records`);
    } catch (err) {
        console.error(err);
        throw err;
    }
};
