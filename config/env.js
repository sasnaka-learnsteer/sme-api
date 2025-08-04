// config/env.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Export the environment variables
module.exports = {
    // Google Sheets Configuration
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    SHEET_ID: process.env.SHEET_ID,

    // MongoDB Configuration
    MONGODB_URI: process.env.MONGODB_URI ,
    MONGODB_DB: process.env.MONGODB_DB ,
    MONGODB_COLLECTION: process.env.MONGODB_COLLECTION ,

    // Other configurations
    PORT: process.env.PORT || 3001,
    JWT_SECRET: process.env.JWT_SECRET
};