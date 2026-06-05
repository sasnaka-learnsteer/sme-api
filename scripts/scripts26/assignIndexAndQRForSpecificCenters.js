// scripts/scripts26/assignIndexAndQRForSpecificCenters.js
// Assigns index numbers and generates QR codes for candidates in Kurunegala and Ratnapura
// Run: node scripts/scripts26/assignIndexAndQRForSpecificCenters.js

require('../../config/env');
const { MongoClient } = require('mongodb');
const { assignIndexNumber26 } = require('../../services/indexNumberService');
const { generateCandidateQRCode } = require('../../services/qrCodeService');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const COLLECTION_NAME = 'sme26registrations';

function getSriLankaTime() {
    const d = new Date();
    const utcTime = d.getTime();
    const slTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
    return slTime.toISOString().replace('Z', '+05:30');
}

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(COLLECTION_NAME);

        const TARGET_CENTERS = ['Kurunegala', 'Ratnapura'];

        // Find candidates who have confirmed these centers but don't have an index number yet
        const candidates = await collection.find({
            exam_center_confirmed26: true,
            final_exam_center: { $in: TARGET_CENTERS },
            $or: [
                { examIndexNumber26: { $exists: false } },
                { examIndexNumber26: null }
            ]
        }).toArray();

        console.log(`Found ${candidates.length} candidates in ${TARGET_CENTERS.join(' or ')} needing index numbers and QR codes.`);

        if (candidates.length === 0) {
            return;
        }

        let processed = 0;
        let failed = 0;

        for (const candidate of candidates) {
            const nic = candidate.NIC || candidate.nic;
            if (!nic) {
                console.log(`Skipping candidate with no NIC (_id: ${candidate._id})`);
                failed++;
                continue;
            }

            console.log(`Processing NIC: ${nic} for ${candidate.final_exam_center}...`);

            // Assign index number from inventory
            const assignedIndexNumber = await assignIndexNumber26(
                db,
                candidate.final_exam_center,
                candidate['Subject Stream'],
                nic
            );

            if (assignedIndexNumber) {
                const updateFields = {
                    examIndexNumber26: assignedIndexNumber,
                    lastUpdated: getSriLankaTime()
                };

                // Generate QR Code
                const qrResult = await generateCandidateQRCode(assignedIndexNumber, getSriLankaTime());
                if (qrResult) {
                    updateFields.qrCode = qrResult.qrCode;
                    updateFields.qrCodeData = qrResult.qrCodeData;
                    updateFields.qrCodeGeneratedAt = getSriLankaTime();
                }

                // Update document
                await collection.updateOne(
                    { _id: candidate._id },
                    { $set: updateFields }
                );

                processed++;
                console.log(`  ✔ Assigned ${assignedIndexNumber}`);
            } else {
                console.log(`  ❌ Failed to assign index number for ${nic} (inventory might be empty for this stream/center)`);
                failed++;
            }
        }

        console.log(`\n✅ Done! Successfully processed: ${processed}, Failed: ${failed}`);

    } catch (err) {
        console.error('Error running script:', err);
    } finally {
        await client.close();
    }
}

run();
