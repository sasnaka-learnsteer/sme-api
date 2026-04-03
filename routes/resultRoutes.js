const express = require('express');
const router = express.Router();
const resultSheetService = require('../services/resultSheetService');

/**
 * @route GET /api/results/sheet/:nic
 * @desc Generate an exam result sheet image for a given NIC
 * @access Public (or add authentication if needed)
 */
router.get('/sheet/:examIndexNumber', async (req, res) => {
    const { examIndexNumber } = req.params;

    if (!examIndexNumber) {
        return res.status(400).json({ success: false, message: 'Exam Index Number is required' });
    }

    try {
        const imageBuffer = await resultSheetService.generateResultSheet(examIndexNumber);

        // Set response headers
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': imageBuffer.length,
            'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        });

        return res.send(imageBuffer);
    } catch (error) {
        if (error.message === 'Candidate not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === 'Results not available for this candidate') {
            return res.status(400).json({ success: false, message: error.message });
        }
        
        console.error('Route error generating result sheet:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate result sheet' });
    }
});

module.exports = router;
