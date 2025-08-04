const env = require('./config/env');
const { google } = require('googleapis');

async function diagnoseDataSync() {
    console.log('🔍 GOOGLE SHEETS DATA SYNC DIAGNOSTIC');
    console.log('=====================================');

    try {
        // Step 1: Check configuration
        console.log('\n📋 STEP 1: Configuration Check');
        console.log('Sheet ID:', env.SHEET_ID);
        console.log('Service Account Key:', env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log('MongoDB Collection:', env.MONGODB_COLLECTION);

        // Step 2: Test Google Sheets authentication
        console.log('\n🔑 STEP 2: Authentication Test');
        const auth = new google.auth.GoogleAuth({
            keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        console.log('✅ Google Sheets API client created successfully');

        // Step 3: Get sheet metadata
        console.log('\n📊 STEP 3: Sheet Metadata');
        const sheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: env.SHEET_ID,
        });
        
        console.log('Available tabs:');
        sheetInfo.data.sheets.forEach((sheet, index) => {
            console.log(`  ${index + 1}. "${sheet.properties.title}"`);
        });
        
        // Step 4: Test data fetching from Form_Responses_1
        console.log('\n📥 STEP 4: Data Fetch Test (Form_Responses_1)');
        try {
            const range = 'Form_Responses_1!A:Z';
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: env.SHEET_ID,
                range,
            });

            const rows = res.data.values;
            if (!rows || rows.length === 0) {
                console.log('❌ No data found in Form_Responses_1');

                // Try the first available tab instead
                const firstTab = sheetInfo.data.sheets[0].properties.title;
                console.log(`\n🔄 Trying first available tab: "${firstTab}"`);

                const altRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: env.SHEET_ID,
                    range: `${firstTab}!A:Z`,
                });

                const altRows = altRes.data.values;
                if (altRows && altRows.length > 0) {
                    console.log(`✅ Found ${altRows.length} rows in "${firstTab}"`);
                    console.log('Headers:', altRows[0]);
                    rows = altRows; // Use this data for further analysis
                }
            } else {
                console.log(`✅ Found ${rows.length} rows in Form_Responses_1`);
                console.log('Headers:', rows[0]);
            }

            // Step 5: Check for NIC column
            if (rows && rows.length > 0) {
                console.log('\n🔍 STEP 5: NIC Column Analysis');
                const headers = rows[0];
                const nicIndex = headers.findIndex(header =>
                    header && header.toString().toUpperCase().includes('NIC')
                );

                if (nicIndex !== -1) {
                    console.log(`✅ Found NIC-related column at index ${nicIndex}: "${headers[nicIndex]}"`);

                    // Check sample data
                    if (rows.length > 1) {
                        const sampleNIC = rows[1][nicIndex];
                        console.log(`Sample NIC value: "${sampleNIC}"`);
                    }
                } else {
                    console.log('❌ No NIC column found!');
                    console.log('Available columns:', headers);
                }

                // Step 6: Simulate data processing
                console.log('\n⚙️  STEP 6: Data Processing Simulation');
                let validRecords = 0;
                for (let i = 1; i < Math.min(rows.length, 6); i++) { // Check first 5 data rows
                    const row = rows[i];
                    const doc = {};
                    headers.forEach((header, j) => {
                        doc[header] = row[j] || '';
                    });

                    if (doc.NIC) {
                        validRecords++;
                    }
                    console.log(`Row ${i}: NIC = "${doc.NIC || 'MISSING'}"${doc.NIC ? ' ✅' : ' ❌'}`);
                }

                console.log(`\nSummary: ${validRecords} out of ${Math.min(rows.length - 1, 5)} records have valid NIC values`);
            }

        } catch (fetchError) {
            console.log('❌ Error fetching data:', fetchError.message);
        }

        console.log('\n🎯 DIAGNOSIS COMPLETE');

    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
        if (error.code === 403) {
            console.log('💡 Solution: Share the Google Sheet with your service account email');
        } else if (error.code === 400) {
            console.log('💡 Solution: Check if the sheet ID is correct');
        }
    }
}

diagnoseDataSync();
