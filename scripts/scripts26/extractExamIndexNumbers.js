const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../../config/env');
const fs = require('fs');

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(MONGODB_DB);

        const categorizedRecords = {};

        // Helper to add to categories
        const addRecord = (center, indexNumber, nic) => {
            if (!center) return;
            // Trim to avoid mismatch due to extra spaces
            const normalizedCenter = center.trim();
            if (!categorizedRecords[normalizedCenter]) {
                categorizedRecords[normalizedCenter] = [];
            }
            
            // Format as CSV row
            const recordStr = `${indexNumber || ''},${nic || ''}`;
            
            // Add if not already there to ensure uniqueness
            if (!categorizedRecords[normalizedCenter].includes(recordStr)) {
                categorizedRecords[normalizedCenter].push(recordStr);
            }
        };

        console.log('Processing sme26registrations...');
        // 1. Process sme26registrations
        const sme26Cursor = db.collection('sme26registrations').find({});
        
        while (await sme26Cursor.hasNext()) {
            const doc = await sme26Cursor.next();
            const confirmed = doc.exam_center_confirmed26;
            let center = doc.final_exam_center;
            const preferredCenter = doc['Preferred Exam Center'] || doc['Prefferd Exam Center'] || doc.preferred_exam_center;
            
            if (confirmed === false && preferredCenter) {
                center = preferredCenter;
            } else if (!center) {
                center = preferredCenter;
            }
            const indexNumber = doc.examIndexNumber26;
            const nic = doc.nic || doc.NIC || doc.Nic || doc.national_id || '';
            
            let include = false;
            if (indexNumber) {
                include = true;
            } else if (!indexNumber && confirmed === false) {
                include = true;
            }

            if (include) {
                addRecord(center, indexNumber, nic);
            }
        }

        console.log('Processing sme25registrations...');
        // 2. Process sme25registrations
        const sme25Cursor = db.collection('sme25registrations').find({});

        while (await sme25Cursor.hasNext()) {
            const doc = await sme25Cursor.next();
            const confirmed = doc.exam_center_confirmed26;
            let center = doc.final_exam_center;
            const preferredCenter = doc['Preferred Exam Center'] || doc['Prefferd Exam Center'] || doc.preferred_exam_center;
            
            if (confirmed === false && preferredCenter) {
                center = preferredCenter;
            } else if (!center) {
                center = preferredCenter;
            }
            const indexNumber = doc.examIndexNumber26;
            const nic = doc.nic || doc.NIC || doc.Nic || doc.national_id || '';
            
            let include = false;
            if (confirmed === true) {
                include = true;
            }

            if (include) {
                addRecord(center, indexNumber, nic);
            }
        }

        // Save the merged data to CSV files (one per center to act as tabs)
        const outputDir = './output/exam_centers_csv';
        if (!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const [center, records] of Object.entries(categorizedRecords)) {
            if (!center) continue;
            
            // Format center name for safe filename
            const safeCenterName = center.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const csvPath = `${outputDir}/${safeCenterName}.csv`;
            
            // CSV Header
            let csvContent = 'examIndexNumber26,NIC\n';
            csvContent += records.join('\n');
            
            fs.writeFileSync(csvPath, csvContent);
        }
        
        console.log(`✅ Extraction complete. CSV files saved in ${outputDir}/`);
        console.log(`Total exam centers categorised: ${Object.keys(categorizedRecords).length}`);
        
        // Print a quick summary
        for (const [center, records] of Object.entries(categorizedRecords)) {
            console.log(` - ${center}: ${records.length} candidates`);
        }

    } catch (error) {
        console.error('❌ Extraction failed:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

run();
