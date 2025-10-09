// utils/generateDeskLabels.js
require('../config/env');
const { MongoClient } = require('mongodb');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// MongoDB connection details
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const collectionName = process.env.MONGODB_COLLECTION;

async function generateDeskLabels() {
  const client = new MongoClient(uri);
  let doc = null;
  let stream = null;

  try {
    await client.connect();
    console.log('Connected to MongoDB for desk label generation');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Query candidates with Galle as preferred center, not rejected
    const candidates = await collection.find({
      "Preferred Exam Center": "Matara",
        "Subject Stream":"Bio Science",
        "participation_status": "confirmed",
        // "participation_status": { $ne: "rejected" },
        // "participation_status": { $ne: "confimre" },
        "examIndexNumber": { $exists: true, $ne: null, $ne: "" } // Only include candidates with a valid exam index number
    })
    .sort({ examIndexNumber: 1 })
    .toArray();

    console.log(`Found ${candidates.length} candidates for desk labels`);

    if (candidates.length === 0) {
      console.log('No candidates found matching criteria');
      return { success: false, error: 'No candidates found' };
    }

    // Create a PDF document
    doc = new PDFDocument({
      size: 'A4',
      margin: 20
    });

    // Pipe output to file
    const outputPath = path.join(__dirname, '../output/desk_labels_matara_bio_confirmed.pdf');
    await ensureDirectoryExists(path.dirname(outputPath));
    stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Define layout parameters
    const pageWidth = doc.page.width - 40;
    const pageHeight = doc.page.height - 40;
    const columns = 2;
    const rows = 13;
    const labelWidth = pageWidth / columns;
    const labelHeight = pageHeight / rows;
    const padding = 5;

    // Generate labels
    let count = 0;
    let currentPage = 1;
    const totalPages = Math.ceil(candidates.length / (columns * rows));

    for (const candidate of candidates) {
      const column = count % columns;
      const row = Math.floor((count % (columns * rows)) / columns);

      const x = column * labelWidth + 20;
      const y = row * labelHeight + 20;

      doc.rect(x + padding, y + padding,
               labelWidth - (2 * padding),
               labelHeight - (2 * padding))
         .stroke();

      doc.font('Helvetica-Bold')
         .fontSize(30)
         .text(candidate.examIndexNumber || 'No Index Number',
               x + padding + 5,
               y + padding + (labelHeight - (2 * padding)) / 2 - 6,
               { width: labelWidth - (2 * padding) - 10, align: 'center' });

      count++;

      if (count % (columns * rows) === 0 && count < candidates.length) {
        doc.addPage();
        currentPage++;
        console.log(`Created page ${currentPage} of ${totalPages}`);
      }
    }

    // Return a promise that resolves when the stream is finished
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log(`Desk labels generated successfully at ${outputPath}`);
        resolve({
          success: true,
          outputPath,
          candidatesCount: candidates.length,
          pagesCount: currentPage
        });
      });

      stream.on('error', reject);
      doc.end();
    });

  } catch (error) {
    console.error('Error generating desk labels:', error);
    if (doc) doc.end();
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (stream) stream.end();
    await client.close();
  }
}

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

// Execute the function if run directly
if (require.main === module) {
  generateDeskLabels()
    .then(result => {
      if (result.success) {
        console.log(`Successfully generated desk labels for ${result.candidatesCount} candidates on ${result.pagesCount} pages`);
        process.exit(0);
      } else {
        console.error('Failed to generate desk labels:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Error running desk label generation:', err);
      process.exit(1);
    });
}

module.exports = { generateDeskLabels };