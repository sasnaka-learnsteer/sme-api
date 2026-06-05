// services/indexNumberService.js
const { MongoClient } = require('mongodb');

/**
 * Assigns an available index number to a candidate from the sme26indexnumbers inventory.
 * 
 * @param {import('mongodb').Db} db - The MongoDB database instance
 * @param {string} finalExamCenter - The final exam center chosen by the candidate
 * @param {string} subjectStream - The candidate's subject stream
 * @param {string} nic - The candidate's NIC or identifier
 * @returns {Promise<string|null>} The assigned index number, or null if none available
 */
async function assignIndexNumber26(db, finalExamCenter, subjectStream, nic) {
    if (!subjectStream || !finalExamCenter || !nic) {
        return null;
    }

    try {
        const indexDocResult = await db.collection('sme26indexnumbers').findOneAndUpdate(
            {
                center_name: finalExamCenter.trim(),
                stream_name: subjectStream,
                is_assigned: false
            },
            {
                $set: {
                    is_assigned: true,
                    status: 'assigned',
                    assigned_to: nic,
                    assigned_at: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        // Handle MongoDB driver versions (v6 returns doc directly, older v4/v5 returns { value: doc })
        const assignedDoc = (indexDocResult && indexDocResult.value) ? indexDocResult.value : indexDocResult;
        
        if (assignedDoc && assignedDoc.index_number) {
            return assignedDoc.index_number;
        } else {
            console.warn(`[IndexService] Failed to assign index number for NIC ${nic}. No available numbers for ${finalExamCenter.trim()} - ${subjectStream}`);
            return null;
        }
    } catch (error) {
        console.error(`[IndexService] Error assigning index number for NIC ${nic}:`, error);
        return null;
    }
}

/**
 * Frees any index numbers assigned to the given NIC in the sme26indexnumbers inventory.
 * 
 * @param {import('mongodb').Db} db - The MongoDB database instance
 * @param {string} nic - The candidate's NIC
 * @returns {Promise<boolean>} True if index numbers were freed, false otherwise
 */
async function freeIndexNumber26(db, nic) {
    if (!nic) return false;

    try {
        const result = await db.collection('sme26indexnumbers').updateMany(
            { assigned_to: nic },
            {
                $set: {
                    is_assigned: false,
                    status: 'available',
                    assigned_to: null,
                    assigned_at: null
                }
            }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        console.error(`[IndexService] Error freeing index number for NIC ${nic}:`, error);
        return false;
    }
}

module.exports = {
    assignIndexNumber26,
    freeIndexNumber26
};
