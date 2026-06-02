// config/env.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Handle Google Service Account Key - parse JSON string from env var into a credentials object
// Works for both local .env and Heroku config vars
let googleServiceAccountKey;
try {
    googleServiceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e.message);
    googleServiceAccountKey = null;
}

// Export the environment variables
module.exports = {
    // Google Sheets Configuration
    GOOGLE_SERVICE_ACCOUNT_KEY: googleServiceAccountKey,
    SHEET_ID: process.env.SHEET_ID,
    SHEET_ID_AMPARA: process.env.SHEET_ID_AMPARA,
    SHEET_ID_MATARA: process.env.SHEET_ID_MATARA,
    ADMIN_SHEET_ID: process.env.ADMIN_SHEET_ID,
    SHEET_ID_CO_TEAM: process.env.SHEET_ID_CO_TEAM,
    RESULTS_SHEET_ID: process.env.RESULTS_SHEET_ID,

    // MongoDB Configuration
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB,
    MONGODB_COLLECTION: process.env.MONGODB_COLLECTION,
    ADMIN_MONGODB_COLLECTION: process.env.ADMIN_MONGODB_COLLECTION,
    EXAMS_MONGO_COLLECTION: process.env.EXAMS_MONGO_COLLECTION,
    MYSME_MONGO_COLLECTION: process.env.MYSME_MONGO_COLLECTION,

    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET,

    // Node Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3001,

    // External APIs
    EXTERNAL_SS_QUIZ_API_URL: process.env.EXTERNAL_SS_QUIZ_API_URL,
    EXTERNAL_SS_QUIZ_API_KEY: process.env.EXTERNAL_SS_QUIZ_API_KEY,

    // Azure Email / OTP Configuration
    AZURE_EMAIL_ENDPOINT: process.env.AZURE_EMAIL_ENDPOINT,
    AZURE_EMAIL_API_KEY: process.env.AZURE_EMAIL_API_KEY
};