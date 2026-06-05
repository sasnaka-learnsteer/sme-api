const sgMail = require('@sendgrid/mail');
const env = require('../config/env');

const otpServiceApiKey = env.SEND_GRID_API_KEY;
const otpSender = env.OTP_SENDER_EMAIL;
sgMail.setApiKey(otpServiceApiKey);

async function sendEmailOtp(email, otp) {
    const expiryMinutes = 5;

    const message = {
        to: email,
        from: `${otpSender}`,
        subject: 'Sasnaka LearnSteer - Password Reset Verification Code',
        text: `Your OTP is ${otp}. It expires in ${expiryMinutes} minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Password Reset Verification</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing: 4px;">${otp}</h1>
                <p>This code will expire in <b>${expiryMinutes} minutes</b>.</p>
                <hr/>
                <small>If you did not request this, ignore this email.</small>
            </div>
        `
    };

    try {
        console.log(`[OTP EMAIL] Sending OTP email to: ${email}`);

        const response = await sgMail.send(message);

        console.log('[OTP EMAIL] Email sent successfully');
        console.log('[OTP EMAIL] Status:', response[0]?.statusCode);

        return {
            success: true,
            message: 'OTP email sent',
            statusCode: response[0]?.statusCode
        };

    } catch (err) {
        console.error('[OTP EMAIL] Failed to send email');
        console.error('[OTP EMAIL] Error:', err.response?.body || err.message);

        throw new Error('Failed to send OTP email');
    }
}
module.exports = { sendEmailOtp };