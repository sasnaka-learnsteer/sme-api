const env = require('../config/env');
const mongoPool = require('../services/mongoConnectionPool');

async function cleanResultsFromMongoDocs() {
    console.log(`Starting cleanup of results objects at ${new Date().toISOString()}`);

    try {
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        // Find documents that have a results field and remove it
        const result = await collection.updateMany(
            { results: { $exists: true } }, // query for docs with results field
            { $unset: { results: "" } }     // remove the results field
        );

        console.log(`✅[Cleanup] Operation completed:`);
        console.log(`   📊 Matched: ${result.matchedCount} documents`);
        console.log(`   🔄 Modified: ${result.modifiedCount} documents`);

        return result;
    } catch (error) {
        console.error('❌[Cleanup] Error during cleanup:', error.message);
        throw error;
    }
}

// Execute the cleanup function
cleanResultsFromMongoDocs()
    .then(() => console.log('Results cleanup complete'))
    .catch(err => console.error('Failed to clean results:', err))
    .finally(() => {
        mongoPool.close();
    });
