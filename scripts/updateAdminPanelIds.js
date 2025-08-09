// scripts/updateAdminPanelIds.js
const { MongoClient } = require('mongodb');
const env = require('../config/env');
const { generateExamIndexNumber } = require('../services/indexNumberGenerator');


function getExamCenterByProvince(province) {
  const mapping = {
    Western: 'colombo',
    Central: 'kandy',
    Southern: 'galle'
  };
  return mapping[province];
}

/**
 * Generate a random 7-digit ID
 * @returns {string} A 7-digit ID
 */
function generatePanelId(admin) {
  try {
    // Map WPNumber to NIC, A/L stream to stream, and use a fixed exam center
    const wpNumber = admin.WPNumber || String(Math.floor(Math.random() * 10000000));
    const stream = admin['A/L stream'];
    const examCenter = getExamCenterByProvince(admin.Province);

    // Use the existing index number generator to create a consistent ID
    return generateExamIndexNumber(wpNumber, examCenter, stream);
  } catch (error) {
    // Fallback to random ID if generation fails
    console.error(`Error generating panel ID: ${error.message}`);
    return Math.floor(1000000 + Math.random() * 9000000).toString();
  }
}


/**
 * Update existing admins with panel IDs and add required fields
 * @returns {Promise<void>}
 */
async function updateExistingAdmins() {
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

    // Find all admins that don't have a panelId yet
    const adminsWithoutPanelId = await collection.find({ panelId: { $exists: false } }).toArray();

    console.log(`Found ${adminsWithoutPanelId.length} admins without panel IDs`);

    if (adminsWithoutPanelId.length === 0) {
      console.log('All admins already have panel IDs');
      return;
    }

    // Get existing panel IDs to avoid duplicates
    const existingIds = new Set();
    const existing = await collection.find({ panelId: { $exists: true } }, { projection: { panelId: 1 } }).toArray();
    existing.forEach(member => existingIds.add(member.panelId));

    // Update each admin with a unique panelId and required fields
    let updatedCount = 0;
    for (const admin of adminsWithoutPanelId) {
      let panelId;
      let attempts = 0;
      const maxAttempts = 10;
      do {
        panelId = generatePanelId(admin);
        attempts++;

        // If we can't generate a unique ID after several attempts, add a random suffix
        if (attempts >= maxAttempts && existingIds.has(panelId)) {
          panelId = panelId.slice(0, 5) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
        }
      } while (existingIds.has(panelId) && attempts < maxAttempts + 1);

      existingIds.add(panelId);

      const result = await collection.updateOne(
          { _id: admin._id },
          {
            $set: {
              panelId,
              mentee_candidates: [],
              candidateCount: 0,
              panelID_assigned_at: new Date()
            }
          }
      );

      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`Updated admin ${admin._id} with panelId: ${panelId}`);
      }
    }

    console.log(`Successfully updated ${updatedCount} admins with panel IDs`);

  } catch (error) {
    console.error('Error creating panel IDs:', error);
  } finally {
    await client.close();
  }
}

module.exports = {
  updateAdminPanelIds: updateExistingAdmins
};