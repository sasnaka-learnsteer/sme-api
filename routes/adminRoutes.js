// routes/adminRoutes.js - Add this route
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
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
    const adminCollection = db.collection('sme25adminpanel');

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
    const adminCollection = db.collection('sme25adminpanel');
    const candidateCollection = db.collection(process.env.MONGODB_COLLECTION);

    // Get panel member data
    const panelMember = await adminCollection.findOne({ panelId: req.panelId });

    if (!panelMember) {
      return res.status(404).json({ message: 'Panel member not found' });
    }

    // Get all assigned candidates for this panel member
    const assignedCandidates = await candidateCollection.find({
      assigned_to_panel: req.panelId
    }).toArray();

    res.status(200).json({
      panelMember,
      assignedCandidates
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    await client.close();
  }
});

module.exports = router;