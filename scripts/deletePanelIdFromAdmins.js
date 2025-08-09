// scripts/deletePanelIdFromAdmins.js
const { MongoClient } = require('mongodb');
const env = require('../config/env');

async function deletePanelIdFromAllAdmins() {
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

    const result = await collection.updateMany(
      { panelId: { $exists: true } },
      { $unset: { panelId: "" } }
    );

    console.log(`Removed panelId from ${result.modifiedCount} documents`);
  } catch (error) {
    console.error('Error removing panelId:', error);
  } finally {
    await client.close();
  }
}

deletePanelIdFromAllAdmins();