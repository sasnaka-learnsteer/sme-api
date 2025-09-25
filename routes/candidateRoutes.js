const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');

const mongoURI = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const candidateCollection = process.env.MONGODB_COLLECTION;


// Backend implementation for MySME API endpoints

// 1. Verify if NIC exists in the database
router.post('/check-nic', async (req, res) => {
    const { NIC } = req.body;

    if (!NIC) {
        return res.status(400).json({ success: false, message: 'NIC is required' });
    }

    try {
        const client = new MongoClient(mongoURI);
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        const candidate = await collection.findOne({ NIC });

        await client.close();

        if (candidate) {
            // Check if the candidate has a MySME account (has password field)
            const hasMySmeAccount = !!candidate.password;

            return res.json({
                success: true,
                exists: true,
                hasMySmeAccount: hasMySmeAccount,
                candidateId: candidate._id
            });
        } else {
            return res.json({
                success: true,
                exists: false,
                hasMySmeAccount: false
            });
        }
    } catch (error) {
        console.error('Error checking NIC:', error);
        return res.status(500).json({ success: false, message: 'Server error while checking NIC' });
    }
});

// Signup for a MySME account
router.post('/signup', async (req, res) => {
    const { NIC, password } = req.body;

    if (!NIC || !password) {
        return res.status(400).json({ success: false, message: 'NIC and password are required' });
    }

    try {
        const client = new MongoClient(mongoURI);
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        // Check if candidate already exists
        const existingCandidate = await collection.findOne({ NIC });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (existingCandidate) {
            // If candidate exists but doesn't have a MySME account
            if (existingCandidate.password) {
                await client.close();
                return res.status(400).json({ success: false, message: 'MySME account already exists for this NIC' });
            }

            // Update candidate with password (create MySME account)
            await collection.updateOne(
                { NIC },
                { $set: {
                        password: hashedPassword,
                        lastUpdated: new Date()
                    }}
            );

            // Create JWT token
            const token = jwt.sign(
                { id: existingCandidate._id, nic: existingCandidate.nic },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            await client.close();
            return res.json({
                success: true,
                token,
                candidateId: existingCandidate._id,
                message: 'MySME account created successfully'
            });

        } else {
            // Create new candidate with MySME account
            const newCandidate = {
                NIC,
                password: hashedPassword,
                createdAt: new Date(),
                lastUpdated: new Date()
            };

            // await collection.insertOne(newCandidate);
            await client.close();

            return res.json({ success: true, message: 'Your NIC is not registered with the exam. Please register first' });
        }
    } catch (error) {
        console.error('Error creating MySME account:', error);
        return res.status(500).json({ success: false, message: 'Server error while creating account' });
    }
});

// Login to MySME account
router.post('/login', async (req, res) => {
    const { NIC, password } = req.body;

    if (!NIC || !password) {
        return res.status(400).json({ success: false, message: 'NIC and password are required' });
    }

    try {
        const client = new MongoClient(mongoURI);
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        const candidate = await collection.findOne({ NIC });

        if (!candidate || !candidate.password) {
            await client.close();
            return res.status(400).json({ success: false, message: 'Invalid credentials or MySME account does not exist' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, candidate.password);

        if (!isMatch) {
            await client.close();
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { id: candidate._id, nic: candidate.nic },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        await client.close();

        return res.json({
            success: true,
            token,
            candidateId: candidate._id
        });

    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ success: false, message: 'Server error while logging in' });
    }
});

// Get candidate profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const client = new MongoClient(mongoURI);
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        const candidate = await collection.findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: {
                    NIC: 1,
                    "Full Name": 1,
                    "School": 1,
                    "Subject Stream": 1,
                    confirmed_papers: 1,
                    qrCodeData: 1,
                    "Preferred Exam Center": 1,
                    examIndexNumber: 1,
                    qrCode: 1,
                    attended_papers: 1,
                    attended_days: 1,
                    _id: 1
                }  }
        );

        await client.close();

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        return res.json({
            success: true,
            candidate
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ success: false, message: 'Server error while fetching profile' });
    }
});

module.exports = router;
