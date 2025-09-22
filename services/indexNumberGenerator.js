// services/indexNumberGenerator.js
const { MongoClient } = require('mongodb');
const env = require('../config/env');

/**
 * Generates a 7-digit numeric exam index number
 * @param {string} nic - The NIC number
 * @param {string} examCenter - The preferred exam center
 * @param stream
 * @returns {string} The generated exam index number
 */
function generateExamIndexNumber(nic, examCenter, stream) {
  if (!nic || typeof nic !== 'string') {
    throw new Error('Invalid NIC format');
  }

    // Determine first digit based on exam center
    let firstDigit;
    switch (examCenter?.trim().toLowerCase()) {
        case 'colombo':
            firstDigit = '1';
            break;
        case 'kandy':
            firstDigit = '2';
            break;
        case 'galle':
            firstDigit = '3';
            break;
        case 'ampara':
            firstDigit = '4';
            break;
        default:
            firstDigit = '9'; // Default for unknown exam centers
    }

    // Determine second digit based on stream
    let secondDigit;
    switch (stream?.trim().toLowerCase()) {
        case 'bio science':
            secondDigit = '0';
            break;
        case 'physical science':
            secondDigit = '1';
            break;
        default:
            secondDigit = '5'; // Default for unknown streams
    }

    // Generate last 5 digits based on NIC
    let hash = 0;
    for (let i = 0; i < nic.length; i++) {
        hash = ((hash << 5) - hash) + nic.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Make positive and ensure 4 digits (0000-9999)
    const lastDigits = String(Math.abs(hash) % 100000).padStart(5, '0');

    return firstDigit + secondDigit + lastDigits;
}

/**
 * Updates all candidates without exam index numbers
 */
async function updateExamIndexNumbers() {
  console.log(`Generating exam index numbers at ${new Date().toISOString()}`);
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection(env.MONGODB_COLLECTION);

    // Find all documents (with Subject Stream) & (participation_status : "confirmed") & (without index number)
    const candidates = await collection.find({
      NIC: { $exists: true, $ne: '' },
      examIndexNumber: { $exists: false },
        "Subject Stream": { $exists: true, $ne: null, $ne: '' },
        participation_status: "confirmed",
    }).toArray();

    console.log(`Found ${candidates.length} candidates [with Subject Stream] & [Participation confirmed] & [without exam index numbers]`);

      // Keep track of used index numbers to avoid duplicates
      const usedIndexNumbers = new Set();

      // First get all existing index numbers
      const existingDocs = await collection.find(
          { examIndexNumber: { $exists: true } },
          { projection: { examIndexNumber: 1 } }
      ).toArray();

      existingDocs.forEach(doc => {
          if (doc.examIndexNumber) usedIndexNumbers.add(doc.examIndexNumber);
      });

    let updatedCount = 0;
    let errorCount = 0;

    for (const candidate of candidates) {
      try {
          let examIndexNumber = generateExamIndexNumber(
              candidate.NIC,
              candidate['Preferred Exam Center'],
              candidate['Subject Stream']
          );

          // If this number is already used, try to find another one
          let attempts = 0;
          const maxAttempts = 20;

          while (usedIndexNumbers.has(examIndexNumber) && attempts < maxAttempts) {
              // Add some random variation to avoid collisions
              const newLastDigits = String((parseInt(examIndexNumber.slice(3)) + 1) % 10000).padStart(4, '0');
              examIndexNumber = examIndexNumber.slice(0, 3) + newLastDigits;
              attempts++;
          }

          if (usedIndexNumbers.has(examIndexNumber)) {
              throw new Error('Failed to generate unique index number after multiple attempts');
          }

          usedIndexNumbers.add(examIndexNumber);

        await collection.updateOne(
          { _id: candidate._id },
          { $set: { examIndexNumber: examIndexNumber } }
        );

        updatedCount++;
      } catch (error) {
        console.error(`Error generating index for NIC ${candidate.NIC}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`
Exam index number generation complete:
- Updated: ${updatedCount} candidates
- Errors: ${errorCount} candidates
    `);

  } catch (error) {
    console.error('Error updating exam index numbers:', error);
  } finally {
    await client.close();
  }
}

module.exports = {
  generateExamIndexNumber,
  updateExamIndexNumbers
};