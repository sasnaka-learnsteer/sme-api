const cron = require('node-cron');
const { MongoClient } = require('mongodb');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const OpenAI = require('openai');
const {MONGODB_DB, MONGODB_COLLECTION} = require("../config/env");

class RegisteredDataScheduler {
  constructor() {
    this.mongoClient = new MongoClient(process.env.MONGODB_URI);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY // Add this to your .env
    });
    this.initGoogleSheets();
  }

  async initGoogleSheets() {
    const serviceAccountAuth = new JWT({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(process.env.SHEET_ID_TO_WRITE, serviceAccountAuth);
    await this.doc.loadInfo();
  }

  async determineGender(fullName, school) {
    try {
      const prompt = `Based on the full name "${fullName}" and school "${school}", determine if this person is likely male or female. Consider cultural naming conventions and any contextual clues from the school name. Respond with only "Male" or "Female".`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10,
        temperature: 0.1
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error determining gender:', error);
      return 'Unknown';
    }
  }

  async processDocumentsToWrite() {
    try {
      await this.mongoClient.connect();
      const db = this.mongoClient.db(MONGODB_DB);
      const collection = db.collection(MONGODB_COLLECTION);

      const documents = await collection.find({
        'Full Name': { $exists: true },
        'School': { $exists: true },
        'Whatsapp Number': { $exists: true }
      }).toArray();

      console.log(`Processing ${documents.length} documents...`);

      // Get or create worksheet
      let sheet = this.doc.sheetsByTitle['sme25registrations_with_confirmation'];
      if (!sheet) {
        sheet = await this.doc.addSheet({
          title: 'sme25registrations_with_confirmation',
          headerValues: ['Full Name', 'School', 'Whatsapp Number', 'Gender']
        });
        await sheet.setHeaderRow(['Full Name', 'School', 'Whatsapp Number', 'Gender']);
      }

      // Load existing rows from sheet
        await sheet.loadHeaderRow();
        const existingRows = await sheet.getRows();

        // Create a map of existing records by WhatsApp number
        const existingRecords = new Map();
        existingRows.forEach((row, index) => {
            if (row.get('Whatsapp Number')) {
                existingRecords.set(row.get('Whatsapp Number'), {
                    row: row,
                    index: index
                });
            }
        });

        let updatedCount = 0;
        let createdCount = 0;

      for (const doc of documents) {
          const whatsappNumber =  doc['Whatsapp Number'];
          const existingRecord = existingRecords.get(whatsappNumber);

          const gender = await this.determineGender(doc['Full Name'], doc['School']);

          if (existingRecord) {
              // Check if any values have changed
              const currentRow = existingRecord.row;
              const hasChanges =
                  currentRow.get('Full Name') !== doc['Full Name'] ||
                  currentRow.get('School') !== doc['School'] ||
                  currentRow.get('Gender') !== gender;

              if (hasChanges) {
                  // Update existing record
                  currentRow.set('Full Name', doc['Full Name']);
                  currentRow.set('School', doc['School']);
                  currentRow.set('Gender', gender);
                  await currentRow.save();
                  updatedCount++;
                  console.log(`Updated record for WhatsApp: ${whatsappNumber}`);
              }
          } else {
              // Create new record
              const newRow = {
                  'Full Name': doc['Full Name'],
                  'School': doc['School'],
                  'Whatsapp Number': whatsappNumber,
                  'Gender': gender
              };

              await sheet.addRow(newRow);
              createdCount++;
              console.log(`Created new record for WhatsApp: ${whatsappNumber}`);
          }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

        console.log(`Gender data processing completed: ${createdCount} created, ${updatedCount} updated`);

    } catch (error) {
      console.error('Error processing documents:', error);
    } finally {
      await this.mongoClient.close();
    }
  }
}

module.exports = {RegisteredDataScheduler};