// scripts/removeMentorship.js
const env = require('../config/env');
const { MongoClient } = require('mongodb');

async function removeMentorship() {
    const client = new MongoClient(env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

        const result = await collection.updateMany(
            {}, // all documents
            { $set: { IsAMentor: false } }
        );

        console.log(`Mentorship removed from ${result.modifiedCount} documents.`);
    } catch (error) {
        console.error('Error removing mentorship:', error);
    } finally {
        await client.close();
    }
}

removeMentorship();