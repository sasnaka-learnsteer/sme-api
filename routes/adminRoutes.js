// routes/adminRoutes.js - Add this route
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const {MONGODB_COLLECTION, MONGODB_DB, MONGODB_URI} = require("../config/env");
const { assignIndexNumber26, freeIndexNumber26 } = require('../services/indexNumberService');
const { generateCandidateQRCode } = require('../services/qrCodeService');
require('dotenv').config();

function getSriLankaTime() {
    const d = new Date();
    const utcTime = d.getTime();
    const slTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
    return slTime.toISOString().replace('Z', '+05:30');
}

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.panelId = decoded.panelId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin login route
router.post('/login', async (req, res) => {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        const { panelId, deviceInfo } = req.body;

        // Validate panel ID format
        if (!panelId || !/^\d{7}$/.test(panelId)) {
            return res.status(400).json({ message: 'Invalid panel ID format' });
        }

        // List of scanner panel IDs (store in database in production)
        const scannerPanelIds = [
        '1335509', '1467182', '1882474', '1454036', '1800377',
        '1960294', '1826998', '1932447', '1184463', '1992877',
        '2211285', '2303038', '2638462', '2018776', '2095143',
        '2378211', '2391207', '2479841', '2712735', '2642690',
        '3805975', '3980726', '3718182', '3821378', '3865612',
        '3031460', '3446413', '3764464', '3980284', '3117590'
        ];

        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        const adminCollection = db.collection(process.env.ADMIN_MONGODB_COLLECTION);

        const panelMember = await adminCollection.findOne({ panelId });
        const isScanner = scannerPanelIds.includes(panelId);

        if (!panelMember && !isScanner) {
            return res.status(401).json({ message: 'Invalid panel ID' });
        }

        // Check for active sessions
        const activeSession = await db.collection(process.env.ADMIN_SESSION_MONGODB_COLLECTION).findOne({ panelId: String(panelId) });

        if (activeSession && activeSession.deviceId !== deviceInfo.deviceId) {
            return res.status(403).json({
                message: 'Login Aborted! Your Account is already logged in on another device'
            });
        }

        // Create or update session
        await db.collection(process.env.ADMIN_SESSION_MONGODB_COLLECTION).updateOne(
            { panelId },
            {
                $set: {
                    panelId,
                    deviceId: deviceInfo.deviceId,
                    userAgent: deviceInfo.userAgent,
                    lastActive: new Date(),
                    role: isScanner ? 'scanner' : 'admin'
                }
            },
            { upsert: true }
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                panelId,
                role: isScanner ? 'scanner' : 'admin',
                deviceId: deviceInfo.deviceId
            }, process.env.JWT_SECRET, { expiresIn: '6h' });

        // Return token and role
        return res.status(200).json({
            token,
            role: isScanner ? 'scanner' : 'admin',
            message: 'Login successful'
        });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await client.close();
  }
});

// Add a logout endpoint
router.post('/logout', verifyAdminToken, async (req, res) => {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        const panelId = req.panelId;

        await client.connect();
        const db = client.db(process.env.MONGODB_DB);

        // Remove active session
        await db.collection(process.env.ADMIN_SESSION_MONGODB_COLLECTION).deleteOne({ panelId: String(panelId) });

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ message: 'Server error' });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

// Dashboard route - fetch assigned candidates
router.get('/dashboard', verifyAdminToken, async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const adminCollection = db.collection(process.env.ADMIN_MONGODB_COLLECTION);
    const candidateCollection = db.collection(process.env.MONGODB_COLLECTION);

    // Get panel member data
    const panelMember = await adminCollection.findOne({ panelId: req.panelId });

    if (!panelMember) {
      return res.status(404).json({ message: 'Panel member not found' });
    }
      // Only include required fields
      const filteredPanelMember = {
          Name: panelMember["Name"],
          candidateCount: panelMember["candidateCount"],
          panelId: panelMember["panelId"],
          IsAMentor: panelMember["IsAMentor"],
      };

    // Get all assigned candidates for this panel member
    const assignedCandidates = await candidateCollection.find(
        { assigned_to_panel: req.panelId },
        {
            projection: {
                'NIC':1,
                'Full Name': 1,
                'Email Address': 1,
                'Preferred Exam Center': 1,
                'Whatsapp Number': 1,
                'examIndexNumber': 1,
                'Preferred_Exam_Center_Confirmed': 1,
                'Subject Stream': 1,
                'confirmed_papers': 1,
                'joined_channels_confirmed': 1,
                'participation_status': 1,
            }
        }
    ).toArray();

    res.status(200).json({
        panelMember: filteredPanelMember,
      assignedCandidates
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await client.close();
  }
});

// GET /api/admin/candidate-by-nic/:nic
router.get('/candidate-by-nic/:nic', async (req, res) => {
    const { nic } = req.params;
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(MONGODB_COLLECTION);

        const candidate = await collection.findOne({ NIC: nic });

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json({ candidate });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        await client.close();
    }
});

router.post('/candidate-update-by-admin', async (req, res) => {
    const { NIC, EmailAddress, WhatsappNumber, SubjectStream, Preferred_Exam_Center_Confirmed, confirmed_papers, joined_channels_confirmed, participation_status } = req.body;
    // if (!NIC) return res.status(400).json({ error: 'NIC required' });

    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const collection = db.collection(MONGODB_COLLECTION);

        const updateFields = {};
        if (EmailAddress) updateFields['Email Address'] = EmailAddress;
        if (WhatsappNumber) updateFields['Whatsapp Number'] = WhatsappNumber;
        if (SubjectStream) updateFields['Subject Stream'] = SubjectStream;
        if (typeof Preferred_Exam_Center_Confirmed === 'boolean') {
            updateFields['Preferred_Exam_Center_Confirmed'] = Preferred_Exam_Center_Confirmed;
        }
        if (Array.isArray(confirmed_papers)) {
            updateFields['confirmed_papers'] = confirmed_papers;
        }
        if (typeof joined_channels_confirmed === 'boolean') {
            updateFields['joined_channels_confirmed'] = joined_channels_confirmed;
        }
        if(participation_status) updateFields['participation_status'] = participation_status;

        const result = await collection.updateOne(
            { NIC },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Document updated', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.close();
    }
});

router.get('/api/exams', verifyAdminToken, async (req, res) => {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        const examsCollection = db.collection(process.env.EXAMS_MONGO_COLLECTION);
        const exams = await examsCollection.find({}).toArray();
        res.json({ exams });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.close();
    }
});

router.post('/candidate-update-exam-center-admin', verifyAdminToken, async (req, res) => {
    const { NIC, newExamCenter } = req.body;
    
    if (!NIC || !newExamCenter || !newExamCenter.trim()) {
        return res.status(400).json({ error: 'NIC and newExamCenter are required' });
    }

    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);
        
        // 1. Verify the newExamCenter is a valid active center
        const validCenter = await db.collection('sme26examcenters').findOne(
            { center_name: newExamCenter.trim(), is_active: true },
            { projection: { center_name: 1 } }
        );
        if (!validCenter) {
            return res.status(400).json({ error: `"${newExamCenter}" is not a valid exam center.` });
        }

        // 2. Find the candidate across collections (sme26registrations, then MONGODB_COLLECTION)
        const collectionsToCheck = ['sme26registrations', MONGODB_COLLECTION];
        let candidate = null;
        let foundCollectionName = null;
        
        for (const collName of collectionsToCheck) {
            if (!collName) continue;
            candidate = await db.collection(collName).findOne({ NIC });
            if (candidate) {
                foundCollectionName = collName;
                break;
            }
        }

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        // 3. Free old index number
        await freeIndexNumber26(db, NIC);

        // 4. Assign new index number
        const subjectStream = candidate['Subject Stream'];
        const assignedIndexNumber = await assignIndexNumber26(db, newExamCenter.trim(), subjectStream, NIC);

        // 5. Generate new QR code if assigned
        let qrCodeData = null;
        let qrCode = null;
        let qrCodeGeneratedAt = null;
        
        if (assignedIndexNumber) {
            const qrResult = await generateCandidateQRCode(assignedIndexNumber, getSriLankaTime());
            if (qrResult) {
                qrCode = qrResult.qrCode;
                qrCodeData = qrResult.qrCodeData;
                qrCodeGeneratedAt = qrResult.qrCodeGeneratedAt;
            }
        }

        // 6. Update candidate document
        const updateFields = {
            final_exam_center: newExamCenter.trim(),
            exam_center_confirmed26: true,
            exam_center_confirmed26_at: getSriLankaTime()
        };

        if (assignedIndexNumber) {
            updateFields.examIndexNumber26 = assignedIndexNumber;
            // Also update examIndexNumber for backward compatibility if needed
            updateFields.examIndexNumber = assignedIndexNumber; 
        }

        if (qrCode) {
            updateFields.qrCode = qrCode;
            updateFields.qrCodeData = qrCodeData;
            updateFields.qrCodeGeneratedAt = qrCodeGeneratedAt;
        }

        const result = await db.collection(foundCollectionName).updateOne(
            { NIC },
            { $set: updateFields }
        );

        res.json({ 
            message: 'Exam center updated successfully', 
            modifiedCount: result.modifiedCount,
            examIndexNumber26: assignedIndexNumber,
            qrCode: qrCode ? 'Generated' : null
        });

    } catch (error) {
        console.error('Error changing exam center by admin:', error);
        res.status(500).json({ error: error.message });
    } finally {
        await client.close();
    }
});

module.exports = router;