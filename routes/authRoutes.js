const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Regular user login endpoint (if needed)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Add your regular user authentication logic here
    res.status(501).json({ 
      message: 'Regular user authentication not implemented yet' 
    });
    
  } catch (error) {
    console.error('Auth login error:', error);
    res.status(500).json({ 
      message: 'Internal server error. Please try again.' 
    });
  }
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    res.json({ valid: true, user: decoded });
  });
});

module.exports = router;
