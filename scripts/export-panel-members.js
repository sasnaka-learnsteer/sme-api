// export-panel-members.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const env = require("../config/env");
require('dotenv').config();

async function exportPanelMembersToCSV() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'sme25';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(env.ADMIN_MONGODB_COLLECTION);

    // Only fetch members with a panelId
    const panelMembers = await collection.find({ IsAMentor: true }).toArray();

    console.log(`Found ${panelMembers.length} panel members with Voted for Mentorship`);

    // Create CSV content with header
    let csvContent = 'Name,District,adminId\n';

    // Add each panel member to the CSV content
    panelMembers.forEach(member => {
      // Escape commas in the name field if any
      const escapedName = member.Name ? `"${member.Name.replace(/"/g, '""')}"` : '';
      const district = member.District ? `"${member.District.replace(/"/g, '""')}"` : '';
      const panelId = member.panelId || '';
      csvContent += `${escapedName},${district},${panelId}\n`;
    });

    // Write to file
    const filename = 'panel_admin_ids.csv';
    fs.writeFileSync(filename, csvContent);

    console.log(`CSV file created successfully: ${filename}`);
  } catch (error) {
    console.error('Error exporting panel members:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

exportPanelMembersToCSV().catch(console.error);