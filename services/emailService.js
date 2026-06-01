// services/emailService.js
const axios = require('axios');
const env = require('../config/env');

/**
 * Sends an OTP email to the candidate's email address using the Azure endpoint.
 * @param {string} email The recipient's email address
 * @param {string} otp The 6-digit OTP code
 * @returns {Promise<{success: boolean, mock?: boolean, data?: any}>}
 */
async function sendEmailOtp(email, otp) {
    if (!env.AZURE_EMAIL_ENDPOINT || env.AZURE_EMAIL_ENDPOINT === 'https://example-azure-endpoint.azurewebsites.net/api/send-otp') {
        console.warn(`⚠️ AZURE_EMAIL_ENDPOINT is not configured or is a placeholder. Skipping Azure request. OTP for ${email}: ${otp}`);
        return { success: true, mock: true };
    }

    try {
        const payload = {
            to: email,
            subject: 'Sasnaka LearnSteer - Password Reset Verification Code',
            body: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
            otp: otp
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (env.AZURE_EMAIL_API_KEY && env.AZURE_EMAIL_API_KEY !== 'your-azure-api-key-here') {
            // Set typical Azure API Key headers and Authorization header for compatibility
            headers['api-key'] = env.AZURE_EMAIL_API_KEY;
            headers['x-api-key'] = env.AZURE_EMAIL_API_KEY;
            headers['Authorization'] = `Bearer ${env.AZURE_EMAIL_API_KEY}`;
        }

        console.log(`Sending OTP email to ${email} via Azure endpoint: ${env.AZURE_EMAIL_ENDPOINT}`);
        const response = await axios.post(env.AZURE_EMAIL_ENDPOINT, payload, { headers });
        console.log('Azure email endpoint response:', response.status, response.data);

        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error calling Azure email endpoint:', error.response?.data || error.message);
        throw new Error(`Failed to send email OTP: ${error.message}`);
    }
}

module.exports = { sendEmailOtp };
