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
    SHEET_ID_AMPARA: process.env.SHEET_ID_AMPARA,
    ADMIN_SHEET_ID: process.env.ADMIN_SHEET_ID,
    SHEET_ID_CO_TEAM: process.env.SHEET_ID_CO_TEAM,

    // MongoDB Configuration
    MONGODB_URI: process.env.MONGODB_URI ,
    MONGODB_DB: process.env.MONGODB_DB ,
    MONGODB_COLLECTION: process.env.MONGODB_COLLECTION ,
    ADMIN_MONGODB_COLLECTION: process.env.ADMIN_MONGODB_COLLECTION ,
    EXAMS_MONGO_COLLECTION: process.env.EXAMS_MONGO_COLLECTION ,
    MYSME_MONGO_COLLECTION: process.env.MYSME_MONGO_COLLECTION ,

    // Other configurations
    PORT: process.env.PORT || 3001,
    JWT_SECRET: process.env.JWT_SECRET
};