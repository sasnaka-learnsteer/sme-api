// routes/adminRoutes.js - Add this route
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const {MONGODB_COLLECTION, MONGODB_DB, MONGODB_URI} = require("../config/env");
require('dotenv').config();

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
  const { panelId } = req.body;
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const adminCollection = db.collection(process.env.ADMIN_MONGODB_COLLECTION);

    const panelMember = await adminCollection.findOne({ panelId });

    if (!panelMember) {
      return res.status(401).json({ message: 'Invalid panel ID' });
    }

    // Generate JWT token
    const token = jwt.sign({ panelId: panelMember.panelId }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await client.close();
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
                'Full Name': 1,
                'Email Address': 1,
                'Preferred Exam Center': 1,
                'Whatsapp Number': 1,
                'examIndexNumber': 1,
                'Preferred_Exam_Center_Confirmed': 1,
                'Subject Stream': 1,
                'confirmed_papers': 1,
                'joined_channels_confirmed': 1
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

router.post('/candidate-update-by-admin', async (req, res) => {
    const { NIC, EmailAddress, WhatsappNumber, SubjectStream, Preferred_Exam_Center_Confirmed, confirmed_papers, joinedChannelsConfirmed } = req.body;
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
        if (typeof joinedChannelsConfirmed === 'boolean') {
            updateFields['joined_channels_confirmed'] = joinedChannelsConfirmed;
        }

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

module.exports = router;