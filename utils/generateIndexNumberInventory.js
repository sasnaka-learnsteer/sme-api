// utils/generateIndexNumberInventory.js
require('../config/env');
const { MongoClient } = require('mongodb');
const {generateExamIndexNumber} = require("../services/indexNumberGenerator");

// MongoDB connection details
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const registrationsCollection = process.env.MONGODB_COLLECTION;
const inventoryCollection = process.env.INVENTORY_MONGODB_COLLECTION;

// Function to generate a random 5-digit number
function generateRandomFiveDigits() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Function to generate exam index number
function generateExtraIndexNumber(center, stream) {
  let prefix = '';

  // Add random 5 digits
  const randomDigits = generateRandomFiveDigits();

    prefix = generateExamIndexNumber(randomDigits, center, stream);

    return `${prefix}${randomDigits}`;
}

async function generateIndexNumberInventory() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const registrations = db.collection(registrationsCollection);
    const inventory = db.collection(inventoryCollection);

    // Define the 6 categories
    const categories = [
      { center: 'Colombo', stream: 'Bio Science', key: 'colombo_bio' },
      { center: 'Colombo', stream: 'Physical Science', key: 'colombo_physical' },
      { center: 'Kandy', stream: 'Bio Science', key: 'kandy_bio' },
      { center: 'Kandy', stream: 'Physical Science', key: 'kandy_physical' },
      { center: 'Galle', stream: 'Bio Science', key: 'galle_bio' },
      { center: 'Galle', stream: 'Physical Science', key: 'galle_physical' }
    ];

    // Get all existing index numbers from registrations
    const existingDocsWithIndex = await registrations.find(
      { examIndexNumber: { $exists: true, $ne: null, $ne: "" } },
      { projection: { examIndexNumber: 1 } }
    ).toArray();

    const existingIndexNumbers = new Set(
      existingDocsWithIndex.map(doc => doc.examIndexNumber)
    );

    console.log(`Found ${existingIndexNumbers.size} existing index numbers`);

    // Initialize or get the inventory document
    let inventoryDoc = await inventory.findOne({ _id: 'examIndexNumbers' });

    if (!inventoryDoc) {
      inventoryDoc = {
        _id: 'examIndexNumbers',
        colombo_bio: [],
        colombo_physical: [],
        kandy_bio: [],
        kandy_physical: [],
        galle_bio: [],
        galle_physical: []
      };
    }

    // Generate 50 numbers for each category
    for (const category of categories) {
      console.log(`Generating index numbers for ${category.center} - ${category.stream}`);

      const numbersToGenerate = 50 - inventoryDoc[category.key].length;

      if (numbersToGenerate <= 0) {
        console.log(`Already have 50+ numbers for ${category.key}, skipping`);
        continue;
      }

      let generatedCount = 0;
      let attempts = 0;
      const maxAttempts = 200; // Safety limit

      while (generatedCount < numbersToGenerate && attempts < maxAttempts) {
        attempts++;
        const indexNumber = generateExamIndexNumber(category.center, category.stream);

        // Check if this index number already exists in registrations or in our inventory
        if (!existingIndexNumbers.has(indexNumber) &&
            !inventoryDoc[category.key].includes(indexNumber)) {

          inventoryDoc[category.key].push(indexNumber);
          generatedCount++;

          // Add to our tracking set to avoid duplicates in future iterations
          existingIndexNumbers.add(indexNumber);
        }
      }

      console.log(`Generated ${generatedCount} new index numbers for ${category.key} in ${attempts} attempts`);
    }

    // Save the updated inventory
    await inventory.updateOne(
      { _id: 'examIndexNumbers' },
      { $set: inventoryDoc },
      { upsert: true }
    );

    console.log('Index number inventory updated successfully');

    return {
      success: true,
      counts: {
        colombo_bio: inventoryDoc.colombo_bio.length,
        colombo_physical: inventoryDoc.colombo_physical.length,
        kandy_bio: inventoryDoc.kandy_bio.length,
        kandy_physical: inventoryDoc.kandy_physical.length,
        galle_bio: inventoryDoc.galle_bio.length,
        galle_physical: inventoryDoc.galle_physical.length
      }
    };

  } catch (error) {
    console.error('Error generating index number inventory:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await client.close();
  }
}

// Execute the function if run directly
if (require.main === module) {
  generateIndexNumberInventory()
    .then(result => {
      if (result.success) {
        console.log('Successfully generated index number inventory:');
        console.log(JSON.stringify(result.counts, null, 2));
        process.exit(0);
      } else {
        console.error('Failed to generate index number inventory:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Error running index number generation:', err);
      process.exit(1);
    });
}

module.exports = { generateIndexNumberInventory };