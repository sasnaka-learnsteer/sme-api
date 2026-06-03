// services/qrCodeService.js
const qrcode = require('qrcode');

/**
 * Generates a QR code for a candidate's index number.
 * 
 * @param {string} indexNumber - The candidate's assigned index number
 * @param {string} timestamp - The timestamp when the QR code is generated
 * @returns {Promise<{qrCode: string, qrCodeData: string, qrCodeGeneratedAt: string} | null>} The QR code payload or null if generation fails
 */
async function generateCandidateQRCode(indexNumber, timestamp) {
    if (!indexNumber) return null;

    try {
        const qrCodeData = `https://sme.sasnaka.org/mysme/login?code=${indexNumber}`;
        const qrCode = await qrcode.toDataURL(qrCodeData);
        
        return {
            qrCode,
            qrCodeData,
            qrCodeGeneratedAt: timestamp
        };
    } catch (error) {
        console.error(`[QRCodeService] Failed to generate QR code for index ${indexNumber}:`, error);
        return null;
    }
}

module.exports = {
    generateCandidateQRCode
};
