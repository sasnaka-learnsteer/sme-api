const env = require('../config/env');
const mongoPool = require('../services/mongoConnectionPool');

async function addResultsReleasedField() {
    console.log(`Starting update to add results_released field at ${new Date().toISOString()}`);

    try {
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        // Update all documents that have a results field
        const result = await collection.updateMany(
            { results: { $exists: true } },
            { $set: { results_released: false } }
        );

        console.log(`✅[Update] Operation completed:`);
        console.log(`   📊 Matched: ${result.matchedCount} documents`);
        console.log(`   🔄 Modified: ${result.modifiedCount} documents`);

        return result;
    } catch (error) {
        console.error('❌[Update] Error adding results_released field:', error.message);
        throw error;
    }
}

// Execute the function
addResultsReleasedField()
    .then(() => console.log('Results_released field update complete'))
    .catch(err => console.error('Failed to add results_released field:', err))
    .finally(() => {
        console.log('Update script finished');
    });
