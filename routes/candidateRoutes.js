const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');
const env = require('../config/env');

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

            // Create JWT token - Fixed to use consistent casing for NIC
            const token = jwt.sign(
                { id: existingCandidate._id.toString(), NIC: existingCandidate.NIC },
                env.JWT_SECRET,  // Using env module's JWT_SECRET
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

    let client;
    try {
        client = new MongoClient(mongoURI);
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

        // Create JWT token with consistent secret key reference
        const token = jwt.sign(
            { id: candidate._id.toString(), NIC: candidate.NIC },
            env.JWT_SECRET,  // Using env module's JWT_SECRET
            { expiresIn: '24h' }
        );

        return res.json({
            success: true,
            token,
            candidateId: candidate._id
        });

    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ success: false, message: 'Server error while logging in' });
    } finally {
        if (client) {
            await client.close();
        }
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
                    "School ": 1,
                    "Subject Stream": 1,
                    confirmed_papers: 1,
                    // qrCodeData: 1,
                    "Preferred Exam Center": 1,
                    examIndexNumber: 1,
                    // qrCode: 1,
                    attended_papers: 1,
                    attended_days: 1,
                    _id: 1,
                    results_released: 1,
                    check_results_button_clicks_count: 1
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

// Update candidate survey results
router.post('/update-survey', authenticateToken, async (req, res) => {
    const {
        extraCurricular,
        achievements,
        volunteeringInterest,
        interests,
        check_results_button_click_complete
    } = req.body;

    // Get NIC from authenticated token instead of request body
    const NIC = req.user.NIC;

    try {
        const client = new MongoClient(mongoURI);
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        // Create update object
        const updateOperation = {
            $set: {
                check_result_survey_results: {
                    survey_extra_curricular: extraCurricular,
                    survey_achievements: achievements,
                    survey_volunteering_interest_ok: volunteeringInterest,
                    survey_volunteering_interests: interests,
                    survey_completed_at: new Date()
                },
                check_results_button_click_complete
            }
        };

        // If click is complete, increment the counter
        if (check_results_button_click_complete) {
            updateOperation.$inc = { check_results_button_clicks_count: 1 };
        }

        const result = await collection.updateOne(
            { NIC: NIC },
            updateOperation
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        await client.close();
        return res.json({
            success: true,
            message: 'Survey data saved successfully'
        });
    } catch (error) {
        console.error('Error saving survey data:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving survey data'
        });
    }
});

// Get candidate results
router.get('/results', authenticateToken, async (req, res) => {
    const startTime = Date.now();
    let client;

    try {
        // Get candidate NIC from authenticated token
        const candidateNIC = req.user.NIC;

        client = new MongoClient(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000
        });

        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(candidateCollection);

        // Fixed query to use correct field name
        const candidateDoc = await collection.findOne({ NIC: candidateNIC });

        if (!candidateDoc) {
            console.log(`Candidate not found: ${candidateNIC}`);
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // Check if results are released for this candidate
        if (!candidateDoc.results_released) {
            console.log(`Results not released for candidate: ${candidateNIC}`);
            return res.status(403).json({
                success: false,
                message: 'Results are not yet released for this candidate'
            });
        }

        // Track result check count
        const checkResultsCount = candidateDoc.check_results_button_clicks_count || 0;
        await collection.updateOne(
            { NIC: candidateNIC },
            {
                $set: {
                    check_results_button_clicks_count: checkResultsCount + 1,
                    last_results_check_at: new Date()
                }
            }
        );

        // Determine subject stream to return appropriate grade
        const subjectStream = candidateDoc['Subject Stream'];
        const isBioScience = subjectStream === 'Bio Science';

        // Extract only the requested fields based on subject stream
        const filteredResults = {
            district_rank: candidateDoc.results?.district_rank || "",
            island_rank: candidateDoc.results?.island_rank || "",
            final_zscore: candidateDoc.results?.final_zscore || "",
            physics_grade: candidateDoc.results?.physics_grade || "",
            chemistry_grade: candidateDoc.results?.chemistry_grade || ""
        };

        // Add bio_grade for Bio Science students or maths_grade for Physical Science students
        if (isBioScience) {
            filteredResults.bio_grade = candidateDoc.results?.bio_grade || "";
        } else {
            filteredResults.maths_grade = candidateDoc.results?.maths_grade || "";
        }

        const duration = Date.now() - startTime;
        console.log(`Results fetched successfully for ${candidateNIC} in ${duration}ms`);

        return res.json({
            success: true,
            results: filteredResults
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error fetching candidate results (${duration}ms):`, error);

        return res.status(500).json({
            success: false,
            message: 'Server error while fetching results'
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

module.exports = router;
