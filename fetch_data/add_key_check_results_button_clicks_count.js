const env = require('../config/env');
const mongoPool = require('../services/mongoConnectionPool');

async function addClicksCountField() {
    console.log(`Starting update to add clicks count field at ${new Date().toISOString()}`);

    try {
        // Assuming the collection name should be different than the exam collection
        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        // Update all documents that have a password field
        const result = await collection.updateMany(
            { results: { $exists: true } },
            { $set: { check_results_button_clicks_count: 0 } }
        );

        console.log(`✅[Update] Operation completed:`);
        console.log(`   📊 Matched: ${result.matchedCount} documents`);
        console.log(`   🔄 Modified: ${result.modifiedCount} documents`);

        return result;
    } catch (error) {
        console.error('❌[Update] Error adding clicks count field:', error.message);
        throw error;
    }
}

// Execute the function
addClicksCountField()
    .then(() => console.log('Clicks count field update complete'))
    .catch(err => console.error('Failed to add clicks count field:', err))
    .finally(() => {
        console.log('Update script finished');
    });
