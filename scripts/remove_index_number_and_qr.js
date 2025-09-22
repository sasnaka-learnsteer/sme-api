const { MongoClient } = require('mongodb');
const env = require('../config/env');

async function removeIndexNumberandQR() {
    const client = new MongoClient(env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.MONGODB_COLLECTION);

        const result = await collection.updateMany(
            {
                examIndexNumber: {
                    $exists: true,
                    $regex: /^9/
                }
                },
            { $unset: { examIndexNumber: "", qrCode: "" } }
        );

        console.log(`Updated ${result.modifiedCount} documents.`);
    } catch (error) {
        console.error('Error removing fields:', error);
    } finally {
        await client.close();
    }
}

removeIndexNumberandQR().then(() => console.log(`Done running the script for Removing index number and qr values from candidates with index numbers starting with 9`));