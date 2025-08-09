// scripts/unassignCandidatesFromPanels.js
const { MongoClient } = require('mongodb');
const env = require('../config/env');

async function unassignCandidatesFromPanels() {
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection(env.MONGODB_COLLECTION);

    // Remove assigned_to_panel from candidates
    const candidateResult = await db.collection(process.env.MONGODB_COLLECTION).updateMany(
        { assigned_to_panel: { $exists: true } },
        { $unset: { assigned_to_panel: "" } }
    );
    console.log(`Resetting assigned_to_panel in ${candidateResult.modifiedCount} registrations docs`);

    // Reset candidateCount and mentee_candidates in admin panel docs
    const adminResult = await db.collection(process.env.ADMIN_MONGODB_COLLECTION).updateMany(
        {},
        { $set: { candidateCount: 0, mentee_candidates: [] } }
    );
    console.log(`Resetting candidateCount and mentee_candidates in ${adminResult.modifiedCount} admin panel docs`);

  } catch (error) {
    console.error('Error unassigning candidates:', error);
  } finally {
    await client.close();
  }
}

unassignCandidatesFromPanels();