// utils/generateDeskLabels.js
// Generates 8 PDF files (one per exam center) with desk labels
// from the sme26indexnumbers inventory collection.
// Run: node utils/generateDeskLables.js

require('../config/env');
const { MongoClient } = require('mongodb');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// MongoDB connection details
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

const INVENTORY_COLLECTION = 'sme26indexnumbers';

async function generateAllDeskLabels() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB for desk label generation');

    const db = client.db(dbName);

    // 1. Load all exam centers
    const centers = await db.collection('sme26examcenters')
      .find({ is_active: true })
      .sort({ center_id: 1 })
      .toArray();

    if (centers.length === 0) {
      console.error('No active exam centers found.');
      return { success: false, error: 'No exam centers found' };
    }

    console.log(`Found ${centers.length} exam centers`);

    // 2. Load all streams for the cover page legend
    const streams = await db.collection('sme26streams')
      .find({ is_active: true })
      .sort({ stream_digit: 1 })
      .toArray();

    // 3. Ensure output directory exists
    const outputDir = path.join(__dirname, '../output/desk_labels_26');
    await ensureDirectoryExists(outputDir);

    const results = [];

    // 4. Process each center
    for (const center of centers) {
      const centerDigit = parseInt(center.center_id.split('-').pop(), 10);

      // Fetch all index numbers for this center, sorted
      const indexNumbers = await db.collection(INVENTORY_COLLECTION)
        .find({ center_id: center.center_id })
        .sort({ index_number: 1 })
        .toArray();

      if (indexNumbers.length === 0) {
        console.log(`  ⚠ No index numbers found for ${center.center_name}, skipping.`);
        continue;
      }

      console.log(`  Generating PDF for ${center.center_name} (${indexNumbers.length} labels)...`);

      const sanitizedName = center.center_name.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
      const outputPath = path.join(outputDir, `desk_labels_${sanitizedName}.pdf`);

      await generateCenterPDF({
        outputPath,
        center,
        centerDigit,
        indexNumbers,
        streams
      });

      results.push({
        center: center.center_name,
        outputPath,
        labelCount: indexNumbers.length
      });

      console.log(`  ✔ ${center.center_name}: ${indexNumbers.length} labels → ${outputPath}`);
    }

    console.log(`\n✅ Generated ${results.length} PDF files in ${outputDir}`);
    return { success: true, results };

  } catch (error) {
    console.error('Error generating desk labels:', error);
    return { success: false, error: error.message };
  } finally {
    await client.close();
  }
}

/**
 * Generates a single PDF for one exam center
 */
async function generateCenterPDF({ outputPath, center, centerDigit, indexNumbers, streams }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 30
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ===== PAGE 1: Cover Page with Index Format =====
    renderCoverPage(doc, center, centerDigit, indexNumbers, streams);

    // ===== PAGE 2+: Desk Labels =====
    doc.addPage();
    renderDeskLabels(doc, indexNumbers);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.end();
  });
}

/**
 * Renders the cover page with center info and index number format explanation
 */
function renderCoverPage(doc, center, centerDigit, indexNumbers, streams) {
  const pageWidth = doc.page.width;

  // Title
  doc.fontSize(28)
     .font('Helvetica-Bold')
     .fillColor('#1e293b')
     .text('SASNAKA MOCK EXAM 2026', 30, 50, { align: 'center', width: pageWidth - 60 });

  doc.fontSize(16)
     .font('Helvetica')
     .fillColor('#3b82f6')
     .text('Desk Labels — Index Number Reference Sheet', 30, 90, { align: 'center', width: pageWidth - 60 });

  // Horizontal line
  doc.moveTo(50, 120).lineTo(pageWidth - 50, 120).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // Center info section
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor('#1e293b')
     .text(`Center: ${center.center_name}`, 50, 145);

  doc.fontSize(12)
     .font('Helvetica')
     .fillColor('#64748b')
     .text(`Center ID: ${center.center_id}`, 50, 175)
     .text(`Location: ${center.center_location || 'N/A'}`, 50, 193)
     .text(`Total Index Numbers: ${indexNumbers.length}`, 50, 211);

  // Horizontal line
  doc.moveTo(50, 240).lineTo(pageWidth - 50, 240).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // Index Number Format Section
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('#1e293b')
     .text('Index Number Format', 50, 260);

  doc.fontSize(12)
     .font('Helvetica')
     .fillColor('#334155')
     .text('Each index number is 7 digits long:', 50, 290);

  // Visual format breakdown
  const boxY = 320;
  const boxH = 50;
  const boxes = [
    { label: 'Digit 1', desc: 'Center', width: 80, color: '#dbeafe' },
    { label: 'Digit 2', desc: 'Stream', width: 80, color: '#fef3c7' },
    { label: 'Digits 3-7', desc: 'Unique ID', width: 160, color: '#d1fae5' }
  ];

  let boxX = 80;
  for (const box of boxes) {
    doc.roundedRect(boxX, boxY, box.width, boxH, 6)
       .fillAndStroke(box.color, '#94a3b8');

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#1e293b')
       .text(box.label, boxX, boxY + 10, { width: box.width, align: 'center' });

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#64748b')
       .text(box.desc, boxX, boxY + 28, { width: box.width, align: 'center' });

    boxX += box.width + 10;
  }

  // Example
  doc.fontSize(12)
     .font('Helvetica')
     .fillColor('#334155')
     .text(`Example for this center:  ${centerDigit}0xxxxx`, 50, boxY + boxH + 25);

  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('#64748b')
     .text(`Where ${centerDigit} = this center's digit`, 70, boxY + boxH + 48);

  // Horizontal line
  const legendY = boxY + boxH + 80;
  doc.moveTo(50, legendY).lineTo(pageWidth - 50, legendY).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // Stream Legend Table
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#1e293b')
     .text('Stream Digit Legend', 50, legendY + 15);

  const tableStartY = legendY + 45;
  const col1X = 70;
  const col2X = 170;
  const col3X = 340;
  const rowH = 26;

  // Table header
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#64748b');
  doc.text('DIGIT', col1X, tableStartY);
  doc.text('STREAM NAME', col2X, tableStartY);
  doc.text('COUNT', col3X, tableStartY);

  doc.moveTo(col1X, tableStartY + 16).lineTo(pageWidth - 80, tableStartY + 16)
     .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

  // Table rows
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    const rowY = tableStartY + 22 + (i * rowH);
    const count = indexNumbers.filter(n => n.stream_digit === s.stream_digit).length;

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1e293b')
       .text(String(s.stream_digit), col1X + 10, rowY);

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#334155')
       .text(s.stream_name, col2X, rowY + 2);

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#334155')
       .text(String(count), col3X + 10, rowY + 2);
  }

  // Footer note
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#94a3b8')
     .text(
       'Print this document and cut along the borders. Place one label on each desk.',
       50,
       doc.page.height - 80,
       { align: 'center', width: pageWidth - 60 }
     );

  doc.fontSize(9)
     .fillColor('#cbd5e1')
     .text(
       `Generated on ${new Date().toISOString().split('T')[0]} — Sasnaka Mock Exam 2026`,
       50,
       doc.page.height - 60,
       { align: 'center', width: pageWidth - 60 }
     );
}

/**
 * Renders the desk label grid across pages
 */
function renderDeskLabels(doc, indexNumbers) {
  const pageWidth = doc.page.width - 60; // 30 margin each side
  const pageHeight = doc.page.height - 60;
  const columns = 2;
  const rows = 13;
  const labelWidth = pageWidth / columns;
  const labelHeight = pageHeight / rows;
  const padding = 5;

  let count = 0;

  for (const item of indexNumbers) {
    const column = count % columns;
    const row = Math.floor((count % (columns * rows)) / columns);

    const x = column * labelWidth + 30;
    const y = row * labelHeight + 30;

    // Draw border
    doc.roundedRect(
      x + padding,
      y + padding,
      labelWidth - (2 * padding),
      labelHeight - (2 * padding),
      3
    ).stroke('#cbd5e1');

    // Index number — large and centered
    doc.font('Helvetica-Bold')
       .fontSize(28)
       .fillColor('#1e293b')
       .text(
         item.index_number || 'N/A',
         x + padding + 5,
         y + padding + (labelHeight - (2 * padding)) / 2 - 8,
         { width: labelWidth - (2 * padding) - 10, align: 'center' }
       );

    count++;

    // New page when the grid is full
    if (count % (columns * rows) === 0 && count < indexNumbers.length) {
      doc.addPage();
    }
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
  generateAllDeskLabels()
    .then(result => {
      if (result.success) {
        console.log('\nSummary:');
        for (const r of result.results) {
          console.log(`  ${r.center}: ${r.labelCount} labels`);
        }
        process.exit(0);
      } else {
        console.error('Failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { generateAllDeskLabels };