const express = require('express');
const router = express.Router();

// Backend implementation for MySME API endpoints

// 1. Verify if NIC exists in the database
router.post('/verify-nic', async (req, res) => {
    try {
        const { NIC } = req.body;

        if (!NIC) {
            return res.status(400).json({ success: false, message: 'NIC is required' });
        }

        // Query MongoDB to check if NIC exists
        const candidate = await db.collection('MONGODB_COLLECTION').findOne({ NIC });

        if (candidate) {
            return res.status(200).json({
                success: true,
                exists: true,
                message: 'Candidate found with this NIC'
            });
        } else {
            return res.status(200).json({
                success: true,
                exists: false,
                message: 'No candidate found with this NIC'
            });
        }
    } catch (error) {
        console.error('Error verifying NIC:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while verifying NIC'
        });
    }
});

// 2. Create a new user account
router.post('/signup', async (req, res) => {
    try {
        const { NIC, username, password } = req.body;

        if (!NIC || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'NIC, username and password are required'
            });
        }

        // Check if NIC exists in the main collection
        const candidate = await db.collection('MONGODB_COLLECTION').findOne({ NIC });

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'No candidate found with this NIC'
            });
        }

        // Check if username already exists
        const existingUser = await db.collection('MYSME_MONGO_COLLECTION').findOne({ username });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        // Check if NIC already registered
        const existingNIC = await db.collection('MYSME_MONGO_COLLECTION').findOne({ NIC });
        if (existingNIC) {
            return res.status(409).json({
                success: false,
                message: 'An account already exists for this NIC'
            });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = {
            NIC,
            username,
            password: hashedPassword,
            examIndexNumber: candidate.examIndexNumber || null,
            createdAt: new Date(),
            lastLogin: new Date()
        };

        await db.collection('MYSME_MONGO_COLLECTION').insertOne(newUser);

        // Generate JWT token for authentication
        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username, NIC: newUser.NIC },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User account created successfully',
            token,
            user: {
                username: newUser.username,
                examIndexNumber: newUser.examIndexNumber
            }
        });
    } catch (error) {
        console.error('Error creating user account:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating account'
        });
    }
});

// 3. Get candidate information
router.get('/candidate-data', authenticateToken, async (req, res) => {
    try {
        // The authenticateToken middleware adds the user info to req.user
        const { NIC } = req.user;

        if (!NIC) {
            return res.status(400).json({
                success: false,
                message: 'User identification failed'
            });
        }

        // Get candidate data from the main collection
        const candidate = await db.collection('MONGODB_COLLECTION').findOne({ NIC });

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate information not found'
            });
        }

        // Return only the necessary fields (exclude sensitive info)
        const candidateData = {
            Name: candidate.Name,
            NIC: candidate.NIC,
            examIndexNumber: candidate.examIndexNumber,
            EmailAddress: candidate.EmailAddress || candidate['Email Address'],
            WhatsappNumber: candidate.WhatsappNumber || candidate['Whatsapp Number'],
            SubjectStream: candidate.SubjectStream || candidate['Subject Stream'],
            Preferred_Exam_Center_Confirmed: candidate.Preferred_Exam_Center_Confirmed || false,
            confirmed_papers: candidate.confirmed_papers || []
        };

        res.status(200).json({
            success: true,
            candidate: candidateData
        });
    } catch (error) {
        console.error('Error fetching candidate data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching candidate data'
        });
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        req.user = user;
        next();
    });
}


module.exports = router;
