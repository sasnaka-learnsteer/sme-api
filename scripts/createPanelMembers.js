// scripts/createPanelMembers.js
const { MongoClient } = require('mongodb');
const env = require('../config/env');

/**
 * Generate a random 7-digit ID
 * @returns {string} A 7-digit ID
 */
function generatePanelId() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

/**
 * Create panel members in the database
 * @param {number} count Number of panel members to create
 * @returns {Promise<void>}
 */
async function createPanelMembers(count = 100) {
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection('sme25adminpanel');

    console.log(`Creating ${count} panel members...`);

    const panelMembers = [];
    const existingIds = new Set();

    // Get existing panel IDs to avoid duplicates
    const existing = await collection.find({}, { projection: { panelId: 1 }}).toArray();
    existing.forEach(member => existingIds.add(member.panelId));

    for (let i = 1; i <= count; i++) {
      let panelId;
      // Ensure unique panel ID
      do {
        panelId = generatePanelId();
      } while (existingIds.has(panelId));

      existingIds.add(panelId);

      panelMembers.push({
        name: `Panel Member ${i}`,
        panelId,
        mentee_candidates: [],
        candidateCount: 0,
        created_at: new Date()
      });
    }

    if (panelMembers.length > 0) {
      const result = await collection.insertMany(panelMembers);
      console.log(`Successfully created ${result.insertedCount} panel members`);

      // Print the first few panel IDs for testing
      panelMembers.slice(0, 5).forEach(member => {
        console.log(`Panel ID: ${member.panelId}, Name: ${member.name}`);
      });
    }

  } catch (error) {
    console.error('Error creating panel members:', error);
  } finally {
    await client.close();
  }
}

// Run the script
createPanelMembers(100)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Script error:', err));