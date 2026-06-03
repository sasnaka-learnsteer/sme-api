// middleware/auth.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token is required'
        });
    }

    try {
        // Verify token using the env module's JWT_SECRET
        jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    console.log(`[Auth] Token expired at ${err.expiredAt}`);
                    return res.status(403).json({
                        success: false,
                        message: 'Token expired'
                    });
                }
                
                console.error('[Auth] Token verification failed:', err.message);
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            // Attach decoded user data to request
            req.user = {
                NIC: decoded.NIC,
                email: decoded.email,
                id: decoded.id,
                role: decoded.role,
                isResetToken: decoded.isResetToken
            };
            req.token = token;

            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

module.exports = { authenticateToken };