require('dotenv').config();
const { generateAndStoreQRCodes } = require('../routes/qrCodeRoutes');

// Run the QR code generation
(async () => {
  try {
    console.log('Starting QR code generation process');
    await generateAndStoreQRCodes();
    console.log('QR code generation completed successfully');
  } catch (error) {
    console.error('Failed to generate QR codes:', error);
  }
})();