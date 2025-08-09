// utils/candidateAssignment.js
const { MongoClient } = require('mongodb');
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
    const adminCollection = db.collection(env.ADMIN_MONGODB_COLLECTION);

    // Get panel members with IsAMentor: true
    const panelMembers = await adminCollection.find({ IsAMentor: true }).toArray();
    if (panelMembers.length === 0) {
      console.log('No panel members with IsAMentor: true found.');
      return;
    }

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

    // Sort panel members by candidateCount (or initialize if not present)
    const sortedPanelMembers = panelMembers
        .map(member => ({
          ...member,
          candidateCount: member.candidateCount || 0
        }))
        .sort((a, b) => a.candidateCount - b.candidateCount);

    const remainingCandidates = [];
    let assignedCount = 0;

    // Helper function for candidate assignment to avoid code duplication
    async function assignCandidateToPanelMember(candidate, panelMember) {
      await adminCollection.updateOne(
          { _id: panelMember._id },
          {
            $addToSet: { mentee_candidates: candidate.NIC },
            $inc: { candidateCount: 1 }
          }
      );

      await candidateCollection.updateOne(
          { _id: candidate._id },
          { $set: { assigned_to_panel: panelMember.panelId } }
      );

      panelMember.candidateCount = (panelMember.candidateCount || 0) + 1;
      assignedCount++;
    }

    // PASS 1: Match candidates with panel members from the same province
    for (const candidate of unassignedCandidates) {
      const candidateProvince = candidate.Province || '';

      // Find panel members from the same province
      const sameProvincePanelMembers = sortedPanelMembers
          .filter(member => member.Province === candidateProvince)
          .sort((a, b) => a.candidateCount - b.candidateCount);

      if (sameProvincePanelMembers.length > 0) {
        await assignCandidateToPanelMember(candidate, sameProvincePanelMembers[0]);
      } else {
        remainingCandidates.push(candidate);
      }
    }

    // PASS 2: Apply province priority rules for remaining candidates
    const finalRemainingCandidates = [];
    for (const candidate of remainingCandidates) {
      const candidateProvince = candidate.Province || '';
      let matched = false;

      // Sort panel members by candidate count
      sortedPanelMembers.sort((a, b) => a.candidateCount - b.candidateCount);

      if (candidateProvince === 'Central') {
        // Central candidates prefer Western panel members
        const westernPanelMembers = sortedPanelMembers
            .filter(member => member.Province === 'Western')
            .sort((a, b) => a.candidateCount - b.candidateCount);

        if (westernPanelMembers.length > 0) {
          await assignCandidateToPanelMember(candidate, westernPanelMembers[0]);
          matched = true;
        }
      } else if (candidateProvince === 'Southern') {
        // Southern candidates prefer Western panel members
        const westernPanelMembers = sortedPanelMembers
            .filter(member => member.Province === 'Western')
            .sort((a, b) => a.candidateCount - b.candidateCount);

        if (westernPanelMembers.length > 0) {
          await assignCandidateToPanelMember(candidate, westernPanelMembers[0]);
          matched = true;
        }
      } else if (candidateProvince === 'Western') {
        // Western candidates can go to any panel member (lowest count)
        await assignCandidateToPanelMember(candidate, sortedPanelMembers[0]);
        matched = true;
      }

      if (!matched) {
        finalRemainingCandidates.push(candidate);
      }
    }

// PASS 3: Assign any remaining candidates to panel members with lowest count
    for (const candidate of finalRemainingCandidates) {
      sortedPanelMembers.sort((a, b) => a.candidateCount - b.candidateCount);
      await assignCandidateToPanelMember(candidate, sortedPanelMembers[0]);
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