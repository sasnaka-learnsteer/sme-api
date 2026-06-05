// scheduler/assignMissingIndexAndQR.js
const { MongoClient } = require('mongodb');
const { assignIndexNumber26 } = require('../services/indexNumberService');
const { generateCandidateQRCode } = require('../services/qrCodeService');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const COLLECTION_NAME = 'sme26registrations';

function getSriLankaTime() {
    const d = new Date();
    const utcTime = d.getTime();
    const slTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
    return slTime.toISOString().replace('Z', '+05:30');
}

/**
 * Scheduled task that retroactively assigns index numbers and generates QR codes 
 * for candidates who have confirmed their exam center but are missing them.
 */
async function assignMissingIndexAndQRForAllCenters() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(COLLECTION_NAME);

        // Fetch all active exam centers
        const centers = await db.collection('sme26examcenters')
            .find({ is_active: true })
            .toArray();

        if (centers.length === 0) {
            console.log('[assignMissingIndexAndQR] No active exam centers found. Exiting.');
            return;
        }

        const centerNames = centers.map(c => c.center_name);

        // Find candidates who have confirmed an active center but don't have an index number
        const candidates = await collection.find({
            exam_center_confirmed26: true,
            final_exam_center: { $in: centerNames },
            $or: [
                { examIndexNumber26: { $exists: false } },
                { examIndexNumber26: null }
            ]
        }).toArray();

        if (candidates.length === 0) {
            console.log(`[assignMissingIndexAndQR] All confirmed candidates in active centers already have index numbers.`);
            return;
        }

        console.log(`[assignMissingIndexAndQR] Found ${candidates.length} candidates missing index/QR across ${centerNames.length} active centers.`);

        let processed = 0;
        let failed = 0;

        for (const candidate of candidates) {
            const nic = candidate.NIC || candidate.nic;
            if (!nic) {
                failed++;
                continue;
            }

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

                const qrResult = await generateCandidateQRCode(assignedIndexNumber, getSriLankaTime());
                if (qrResult) {
                    updateFields.qrCode = qrResult.qrCode;
                    updateFields.qrCodeData = qrResult.qrCodeData;
                    updateFields.qrCodeGeneratedAt = getSriLankaTime();
                }

                await collection.updateOne(
                    { _id: candidate._id },
                    { $set: updateFields }
                );

                processed++;
            } else {
                failed++;
            }
        }

        console.log(`[assignMissingIndexAndQR] Done. Processed: ${processed}, Failed: ${failed}`);
    } catch (err) {
        console.error('[assignMissingIndexAndQR] Error:', err);
    } finally {
        await client.close();
    }
}

module.exports = { assignMissingIndexAndQRForAllCenters };
