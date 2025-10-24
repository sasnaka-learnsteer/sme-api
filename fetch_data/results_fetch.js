const env = require('../config/env');
const { google } = require('googleapis');
const mongoPool = require('../services/mongoConnectionPool');

// Cache to avoid unnecessary API calls
let sheetsDataCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache

async function fetchExamResultsData() {
    console.log('Starting Exam Results data fetch from Google Sheet...');

    const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'Sheet1!A:Z';
    const spreadsheetId = env.RESULTS_SHEET_ID;

    try {
        // Check cache first
        const cacheKey = `${spreadsheetId}-${range}`;
        const cachedData = sheetsDataCache.get(cacheKey);

        if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
            console.log(`Using cached exam results data`);
            return cachedData.data;
        }

        console.log(`Fetching fresh exam results data`);

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log(`No exam results data found`);
            return [];
        }

        const headers = rows[0];
        const resultsData = rows.slice(1).map(row => {
            let doc = {};
            headers.forEach((header, i) => {
                doc[header] = row[i] || '';
            });
            return doc;
        });

        // Cache the processed data
        sheetsDataCache.set(cacheKey, {
            data: resultsData,
            timestamp: Date.now()
        });

        console.log(`Processed ${resultsData.length} exam results`);
        return resultsData;
    } catch (error) {
        console.error(`Error fetching exam results data:`, error.message);
        return [];
    }
}

// Function to assign grade based on score
function assignGrade(score) {
    if (!score || isNaN(parseFloat(score))) return 'Absent';

    const numericScore = parseFloat(score);

    // Mark as Absent if score is 0
    if (numericScore === 0) return 'Absent';

    if (numericScore >= 75) return 'A';
    if (numericScore >= 65) return 'B';
    if (numericScore >= 55) return 'C';
    if (numericScore >= 10) return 'S';
    if (numericScore > 0) return 'F';
    return 'Absent';
}

function processScore(score) {
    if (!score || isNaN(parseFloat(score))) return '';

    const numericScore = parseFloat(score);

    // Don't add points if score is 0
    if (numericScore === 0) return '0';

    // Add 20 points to non-zero scores
    const adjustedScore = numericScore + 20;

    // Cap at 100 if exceeding
    return Math.min(adjustedScore, 100).toString();
}


async function updateExamResults() {
    console.log(`Running exam results update at ${new Date().toISOString()}`);

    try {
        const resultsData = await fetchExamResultsData();

        if (resultsData.length === 0) {
            console.log('No exam results data to process');
            return;
        }

        const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);

        let updatedCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;

        // Process in batches
        const batchSize = 50;
        for (let i = 0; i < resultsData.length; i += batchSize) {
            const batch = resultsData.slice(i, i + batchSize);
            const bulkOps = [];

            for (const result of batch) {
                try {
                    if (!result.NIC) {
                        notFoundCount++;
                        continue;
                    }

                    const resultsObject = {
                        maths_final_score: result["Maths Final"],
                        physics_final_score: result["Phy Final"],
                        chemistry_final_score: result["Chem Final"],
                        district_rank: result["District Rank"] || '',
                        island_rank: result["Island Rank"] || '',
                        final_zscore: result["Final Z Score"] || '',
                        maths_grade: assignGrade(result["Maths Final"]),
                        physics_grade: assignGrade(result["Phy Final"]),
                        chemistry_grade: assignGrade(result["Chem Final"])
                    };

                    bulkOps.push({
                        updateOne: {
                            filter: { NIC: result.NIC },
                            update: { $set: { results: resultsObject } }
                        }
                    });
                } catch (error) {
                    console.error(`Error processing result for NIC ${result.NIC}:`, error.message);
                    errorCount++;
                }
            }

            if (bulkOps.length > 0) {
                try {
                    const result = await collection.bulkWrite(bulkOps);
                    updatedCount += result.modifiedCount;
                    notFoundCount += (bulkOps.length - result.modifiedCount);
                } catch (bulkError) {
                    console.error('Bulk operation error:', bulkError.message);
                    errorCount += bulkOps.length;
                }
            }
        }

        console.log(`✅[Exam Results] Update completed:`);
        console.log(`   🔄 Updated: ${updatedCount}`);
        console.log(`   ⚠️ Not found: ${notFoundCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);

    } catch (error) {
        console.error('❌[Exam Results] Error during update:', error.message);
    }
}

updateExamResults()
    .then(() => console.log('Exam results update complete'))
    .catch(err => console.error('Failed to update exam results:', err));
