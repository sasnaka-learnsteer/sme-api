const qrcode = require('qrcode');
const mongoPool = require('../services/mongoConnectionPool');
const express = require('express');
const router = express.Router();

// Cache for QR codes to avoid regeneration
const qrCodeCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

// Function to generate QR codes for all candidates - optimized with bulk operations
async function generateAndStoreQRCodes() {
  try {
    const collection = await mongoPool.getCollection(process.env.MONGODB_COLLECTION);

    // Get candidates without QR codes in batches to reduce memory usage
    const batchSize = 100;
    let skip = 0;
    let totalProcessed = 0;

    while (true) {
      const candidates = await collection.find({ qrCode: { $exists: false } })
        .skip(skip)
        .limit(batchSize)
        .toArray();

      if (candidates.length === 0) break;

      console.log(`Processing batch of ${candidates.length} candidates (total processed: ${totalProcessed})`);

      const bulkOps = [];

      for (const candidate of candidates) {
        if (!candidate.examIndexNumber) {
          continue;
        }

        const qrUrl = `https://sme.sasnaka.org/mysme/login?code=${candidate.examIndexNumber}`;
        const qrCodeDataUrl = await qrcode.toDataURL(qrUrl);

        bulkOps.push({
          updateOne: {
            filter: { _id: candidate._id },
            update: {
              $set: {
                qrCode: qrCodeDataUrl,
                qrCodeData: qrUrl,
                qrCodeGeneratedAt: new Date()
              }
            }
          }
        });

        // Cache the generated QR code
        qrCodeCache.set(candidate.examIndexNumber, {
          qrCode: qrCodeDataUrl,
          timestamp: Date.now()
        });
      }

      // Execute bulk operations for this batch
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps, { ordered: false });
        console.log(`Generated QR codes for ${bulkOps.length} candidates in this batch`);
      }

      totalProcessed += candidates.length;
      skip += batchSize;

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`QR code generation completed. Total processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error generating QR codes:', error);
  }
}

// API route to get QR code by examIndexNumber - with caching
router.get('/get-qr/:examIndexNumber', async (req, res) => {
  try {
    const examIndexNumber = req.params.examIndexNumber;

    // Check cache first
    const cachedQR = qrCodeCache.get(examIndexNumber);
    if (cachedQR && (Date.now() - cachedQR.timestamp) < CACHE_DURATION) {
      return res.status(200).send(cachedQR.qrCode);
    }

    const collection = await mongoPool.getCollection(process.env.MONGODB_COLLECTION);
    const candidate = await collection.findOne(
      { examIndexNumber },
      { projection: { qrCode: 1, _id: 1 } } // Only fetch needed fields
    );

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!candidate.qrCode) {
      // Generate QR code if not already present
      const qrUrl = `https://sme.sasnaka.org/mysme/login?code=${examIndexNumber}`;
      const qrCodeDataUrl = await qrcode.toDataURL(qrUrl);

      await collection.updateOne(
        { _id: candidate._id },
        { $set: {
          qrCode: qrCodeDataUrl,
          qrCodeData: qrUrl,
          qrCodeGeneratedAt: new Date()
        }}
      );

      // Cache the generated QR code
      qrCodeCache.set(examIndexNumber, {
        qrCode: qrCodeDataUrl,
        timestamp: Date.now()
      });

      return res.status(200).send(qrCodeDataUrl);
    }

    // Cache the existing QR code
    qrCodeCache.set(examIndexNumber, {
      qrCode: candidate.qrCode,
      timestamp: Date.now()
    });

    res.status(200).send(candidate.qrCode);
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API route to verify QR code by scanning - optimized
router.get('/verify-qr/:examIndexNumber', async (req, res) => {
  const examIndexNumber = req.params.examIndexNumber;

  try {
    const candidateCollection = process.env.MONGODB_COLLECTION;
    const collectionsToCheck = ['sme26registrations', candidateCollection];

    let candidate = null;
    let foundCollectionName = null;

    // Find the candidate by exam index number across collections
    for (const collName of collectionsToCheck) {
      if (!collName) continue;
      const collection = await mongoPool.getCollection(collName);
      candidate = await collection.findOne(
        { examIndexNumber26: examIndexNumber },
        { projection: { attended_days: 1, _id: 0 } } // Only fetch needed fields
      );
      if (candidate) {
        foundCollectionName = collName;
        break;
      }
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code or candidate not found'
      });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get or initialize the attended_days array
    const attendedDays = candidate.attended_days || [];

    // Check if candidate has already been marked for today
    if (attendedDays.includes(today)) {
      return res.status(200).json({
        success: true,
        message: 'Attendance is Marked',
        warning: true,
        examIndexNumber: examIndexNumber,
        attendedDays: attendedDays
      });
    }

    // Add today to the attended_days array
    const updatedAttendedDays = [...attendedDays, today];

    // Update the candidate's attendance record
    const foundCollection = await mongoPool.getCollection(foundCollectionName);
    await foundCollection.updateOne(
      { examIndexNumber26: examIndexNumber },
      { $set: { attended_days: updatedAttendedDays } }
    );

    // Return the attendance confirmation
    return res.status(200).json({
      success: true,
      message: 'Marked Attendance',
      warning: false,
      examIndexNumber: examIndexNumber,
      attendedDays: updatedAttendedDays
    });
  } catch (error) {
    console.error('Error verifying QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
module.exports.generateAndStoreQRCodes = generateAndStoreQRCodes;