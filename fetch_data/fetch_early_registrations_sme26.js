const axios = require('axios');
const env = require('../config/env'); // Load environment variables and configuration
const { MongoClient } = require('mongodb');

// Replace this URL with the Web App URL you get after deploying the Google Apps Script
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyKCIPwAhMTdWJDprrbwbZP0o60FqTaDB-G55nX2XHpGPir_u36I-WKS5XKRS5Njv4uxA/exec';

const mongoURI = env.MONGODB_URI;

async function fetchSheetData() {
    let client;
    try {
        console.log('Fetching data from Google Sheet via Apps Script...');
        const response = await axios.get(WEB_APP_URL);
        
        if (response.data && response.data.success) {
            const data = response.data.data;
            console.log(`Successfully fetched ${data.length} records. Connecting to MongoDB...`);
            
            client = new MongoClient(mongoURI);
            await client.connect();
            const db = client.db(env.MONGODB_DB);
            const collection = db.collection('sme26registrations');

            let insertedCount = 0;
            let skippedCount = 0;

            for (const record of data) {
                // Ensure NIC is present
                if (!record.NIC) {
                    console.log(`Skipping record without NIC: ${record['First Name'] || 'Unknown'}`);
                    continue;
                }

                // Convert NIC to string to ensure it's saved as a string in the DB
                record.NIC = String(record.NIC).trim();

                // Check if already registered
                const existing = await collection.findOne({ NIC: record.NIC });
                if (!existing) {
                    // Add createdAt if not present
                    record.createdAt = new Date();
                    await collection.insertOne(record);
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            }

            console.log(`✅ Sync Complete: ${insertedCount} inserted, ${skippedCount} skipped (already exist).`);
            return data;
        } else {
            console.error('Failed to fetch data or unexpected response format:', response.data);
        }
    } catch (error) {
        console.error('Error fetching/saving data:', error.message);
    } finally {
        if (client) {
            await client.close();
            console.log('MongoDB connection closed.');
        }
    }
}

// Execute the function
fetchSheetData();
