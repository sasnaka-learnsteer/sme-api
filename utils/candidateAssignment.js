// utils/candidateAssignment.js
const { MongoClient } = require('mongodb');
const path = require('path');
const env = require('../config/env');

/**
 * Assigns unassigned candidates to panel members on first-come-first-serve basis
 * @returns {Promise<{success: boolean, message: string, assignedCount: number}>}
 */
async function assignCandidatesToPanelMembers() {
  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    const candidateCollection = db.collection(env.MONGODB_COLLECTION);
    const adminCollection = db.collection('sme25adminpanel');

    // Get all panel members
    const panelMembers = await adminCollection.find({}).toArray();

    if (panelMembers.length === 0) {
      return {
        success: false,
        message: 'No panel members found in the system',
        assignedCount: 0
      };
    }

    // Get all candidates without panel assignment
    const unassignedCandidates = await candidateCollection.find({
      assigned_to_panel: { $exists: false }
    }).toArray();

    if (unassignedCandidates.length === 0) {
      return {
        success: true,
        message: 'No unassigned candidates found',
        assignedCount: 0
      };
    }

    let assignedCount = 0;
    let candidateIndex = 0;

    // Sort panel members by candidateCount (or initialize if not present)
    const sortedPanelMembers = panelMembers
        .map(member => ({
          ...member,
          candidateCount: member.candidateCount || 0
        }))
        .sort((a, b) => a.candidateCount - b.candidateCount);

    // Keep assigning until all candidates are assigned
    while (candidateIndex < unassignedCandidates.length) {
      // Re-sort panel members after each round to ensure balance
      sortedPanelMembers.sort((a, b) => a.candidateCount - b.candidateCount);

      for (const panelMember of sortedPanelMembers) {
        if (candidateIndex >= unassignedCandidates.length) break;

        const candidate = unassignedCandidates[candidateIndex];

        // Update panel member document
        await adminCollection.updateOne(
            { _id: panelMember._id },
            {
              $addToSet: { mentee_candidates: candidate.NIC },
              $inc: { candidateCount: 1 }
            }
        );

        // Update candidate document
        await candidateCollection.updateOne(
            { _id: candidate._id },
            { $set: { assigned_to_panel: panelMember.panelId } }
        );

        // Update the local count for sorting in next round
        panelMember.candidateCount = (panelMember.candidateCount || 0) + 1;

        assignedCount++;
        candidateIndex++;
      }
    }

    return {
      success: true,
      message: `Successfully assigned ${assignedCount} candidates to panel members`,
      assignedCount
    };

  } catch (error) {
    console.error('Error assigning candidates:', error);
    return {
      success: false,
      message: `Error assigning candidates: ${error.message}`,
      assignedCount: 0
    };
  } finally {
    await client.close();
  }
}

module.exports = { assignCandidatesToPanelMembers };