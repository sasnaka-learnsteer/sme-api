const env = require('../config/env');
const mongoPool = require('../services/mongoConnectionPool');

async function addDistrictsToDocuments() {
    console.log(`Starting district array update at ${new Date().toISOString()}`);

    // Districts array to be added to each document - only names as strings
    const districtsArray = [
        "Colombo",
        "Kalutara",
        "Gampaha",
        "Kandy",
        "Matale",
        "Nuwara Eliya",
        "Galle",
        "Matara",
        "Hambantota"
    ];

    try {
        const collection = await mongoPool.getCollection(env.EXAMS_MONGO_COLLECTION || "sme25exams");

        // Add the districts_associated array to all documents
        const result = await collection.updateMany(
            {}, // empty filter to match all documents
            { $set: { districts_associated: districtsArray } }
        );

        console.log(`✅[Update] Operation completed:`);
        console.log(`   📊 Matched: ${result.matchedCount} documents`);
        console.log(`   🔄 Modified: ${result.modifiedCount} documents`);

        return result;
    } catch (error) {
        console.error('❌[Update] Error adding districts array:', error.message);
        throw error;
    }
}

// Execute the function
addDistrictsToDocuments()
    .then(() => console.log('Districts array update complete'))
    .catch(err => console.error('Failed to update districts array:', err))
    .finally(() => {
        console.log('Update script finished');
    });
