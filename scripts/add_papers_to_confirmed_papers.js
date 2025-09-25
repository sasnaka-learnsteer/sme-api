const { MongoClient } = require('mongodb');
const env = require('../config/env');

async function addSubjectsToConfirmedPapers() {
    const client = new MongoClient(env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(env.MONGODB_DB);
        const collection = db.collection(env.MONGODB_COLLECTION);

        // For Physical Science stream
        const physicalScienceResult = await collection.updateMany(
            {
                "Preferred Exam Center": "Ampara",
                "Subject Stream": "Physical Science"
            },
            {
                $addToSet: {
                    confirmed_papers: {
                        $each: [
                            "Physics I",
                            "Physics II",
                            "Combined Maths I",
                            "Combined Maths II",
                            "Chemistry I",
                            "Chemistry II"
                        ]
                    }
                }
            }
        );

        // For Bio Science stream
        const bioScienceResult = await collection.updateMany(
            {
                "Preferred Exam Center": "Ampara",
                "Subject Stream": "Bio Science"
            },
            {
                $addToSet: {
                    confirmed_papers: {
                        $each: [
                            "Physics I",
                            "Physics II",
                            "Biology I",
                            "Biology II",
                            "Chemistry I",
                            "Chemistry II"
                        ]
                    }
                }
            }
        );

        console.log(`Updated ${physicalScienceResult.modifiedCount} Physical Science documents.`);
        console.log(`Updated ${bioScienceResult.modifiedCount} Bio Science documents.`);
    } catch (error) {
        console.error('Error adding subjects:', error);
    } finally {
        await client.close();
    }
}

addSubjectsToConfirmedPapers().then(() => console.log('Done adding subjects to confirmed_papers array for Ampara candidates.'));
