const qrcode = require('qrcode');
const { MongoClient } = require('mongodb');
const express = require('express');
const router = express.Router();

// MongoDB connection using environment variables
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const collectionName = process.env.MONGODB_COLLECTION;

// Function to generate QR codes for all candidates
async function generateAndStoreQRCodes() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB for QR fetch');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Get all candidates that don't have QR codes yet
    const candidates = await collection.find({ qrCode: { $exists: false } }).toArray();

    console.log(`Found ${candidates.length} candidates without QR codes`);

    for (const candidate of candidates) {
      if (!candidate.examIndexNumber) {
        continue;
      }

        // Create a URL with the examIndexNumber as a query parameter
        const qrUrl = `https://sme.sasnaka.org/mysme/login?code=${candidate.examIndexNumber}`;


        // Generate QR code as data URL containing the examIndexNumber
      const qrCodeDataUrl = await qrcode.toDataURL(qrUrl);

      // Update the candidate document with the QR code
      await collection.updateOne(
        { _id: candidate._id },
        { $set: {
                qrCode: qrCodeDataUrl,
                qrCodeData: qrUrl,
                qrCodeGeneratedAt: new Date()
        }
        }
      );

      console.log(`Generated QR code for candidate with examIndexNumber: ${candidate.examIndexNumber}`);
    }

    console.log('QR code generation completed');
  } catch (error) {
    console.error('Error generating QR codes:', error);
  } finally {
    await client.close();
  }
}

// API route to get QR code by examIndexNumber
router.get('/get-qr/:examIndexNumber', async (req, res) => {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const examIndexNumber = req.params.examIndexNumber;
    const candidate = await collection.findOne({ examIndexNumber });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (!candidate.qrCode) {
      // Generate QR code if not already present
      const qrCodeDataUrl = await qrcode.toDataURL(candidate.examIndexNumber);

      await collection.updateOne(
        { _id: candidate._id },
        { $set: { qrCode: qrCodeDataUrl } }
      );

      return res.status(200).send(qrCodeDataUrl);
    }

    res.status(200).send(candidate.qrCode);
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
});

// API route to verify QR code by scanning
router.get('/verify-qr/:examIndexNumber', async (req, res) => {
  const examIndexNumber = req.params.examIndexNumber;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

      // Find the candidate by exam index number
      const candidate = await collection.findOne({ examIndexNumber });
      if (!candidate) {
          return res.status(404).json({
              success: false,
              message: 'Invalid QR code or candidate not found'
          });
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date()
          .toLocaleString('en-US', { timeZone: 'Asia/Colombo' })
          .split(',')[0]
          .split('/')
          .map(part => part.padStart(2, '0'))
          .reverse()
          .join('-');

      // Get or initialize the attended_days array
      const attendedDays = candidate.attended_days || [];

      // Check if candidate has already been marked for today
      if (attendedDays.includes(today)) {
          return res.status(200).json({
              success: true,
              message: 'Attendance is already Marked for this Candidate',
              warning: true,
              examIndexNumber: examIndexNumber,
              attendedDays: attendedDays
          });
      }

      // Add today to the attended_days array
      const updatedAttendedDays = [...attendedDays, today];

      // Update the candidate's attendance record
      await collection.updateOne(
          { examIndexNumber },
          { $set: { attended_days: updatedAttendedDays } }
      );

      // Return the attendance confirmation
      return res.status(200).json({
          success: true,
          verified: true,
          message: 'Marked Attendance',
          warning: false,
          examIndexNumber: examIndexNumber,
          attendedDays: updatedAttendedDays
      });
  } catch (error) {
    console.error('Error verifying QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
});

// Export the function to be used elsewhere
module.exports = router;
module.exports.generateAndStoreQRCodes = generateAndStoreQRCodes;