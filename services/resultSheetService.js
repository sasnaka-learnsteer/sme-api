const sharp = require('sharp');
const QRCode = require('qrcode');
const mongoPool = require('./mongoConnectionPool');
const env = require('../config/env');

class ResultSheetService {
    /**
     * Generate a result sheet image for a given NIC
     * @param {string} nic 
     * @returns {Promise<Buffer>} PNG image buffer
     */
    async generateResultSheet(examIndexNumber) {
        try {
            // 1. Fetch candidate data
            const collection = await mongoPool.getCollection(env.MONGODB_COLLECTION);
            const candidate = await collection.findOne({ examIndexNumber: examIndexNumber });

            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (!candidate.results) {
                throw new Error('Results not available for this candidate');
            }

            // 2. Determine subject stream and additional subjects
            const isBioScience = candidate['Subject Stream'] === 'Bio Science';
            const subjectStream = candidate['Subject Stream'] || 'N/A';
            
            const results = [
                { 
                    subject: 'Physics', 
                    grade: candidate.results.physics_grade || 'N/A' 
                },
                { 
                    subject: 'Chemistry', 
                    grade: candidate.results.chemistry_grade || 'N/A' 
                }
            ];

            if (isBioScience) {
                results.unshift({ subject: 'Biology', grade: candidate.results.bio_grade || 'N/A' });
            } else {
                results.unshift({ subject: 'Combined Maths', grade: candidate.results.maths_grade || 'N/A' });
            }

            // 3. Prepare data for the template
            const data = {
                name: candidate['Full Name'] || 'N/A',
                nic: candidate['NIC'] || 'N/A',
                batch: candidate['AL Batch'] || 'N/A',
                district: candidate['District'] || 'N/A',
                examCenter: candidate['Preferred Exam Center'] || 'N/A',
                stream: subjectStream,
                index: candidate.examIndexNumber || 'N/A',
                results: results,
                zscore: candidate.results.final_zscore || 'N/A',
                districtRank: candidate.results.district_rank || 'N/A',
                islandRank: candidate.results.island_rank || 'N/A'
            };

            // 4. Generate QR Code
            const qrCodeDataUrl = await QRCode.toDataURL(`https://sme.sasnaka.org/verify/${data.index}`, {
                color: {
                    dark: '#1e293b',  // Dark blue
                    light: '#ffffff' // White background
                },
                margin: 1
            });
            
            // 5. Create SVG template (Portrait v2)
            const svg = this._getSvgTemplate(data, qrCodeDataUrl);

            // 6. Convert SVG to PNG with high quality
            const pngBuffer = await sharp(Buffer.from(svg), { density: 144 })
                .png()
                .toBuffer();

            return pngBuffer;
        } catch (error) {
            console.error('Error generating result sheet:', error.message);
            throw error;
        }
    }

    _getSvgTemplate(data, qrCodeDataUrl) {
        const { name, nic, batch, district, examCenter, stream, index, results, zscore, districtRank, islandRank } = data;
        
        // Truncate name if too long
        const displayName = name.length > 55 ? name.substring(0, 52) + '...' : name;

        return `
        <svg width="600" height="850" viewBox="0 0 600 850" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000" flood-opacity="0.1"/>
                </filter>
                <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#f1f5f9;stop-opacity:1" />
                </linearGradient>
            </defs>

            <!-- Main Background -->
            <rect width="600" height="850" fill="#ffffff" />
            <rect x="2" y="2" width="596" height="846" fill="none" stroke="#e2e8f0" stroke-width="2" rx="16"/>

            <!-- Header Section -->
            <rect x="30" y="30" width="540" height="120" fill="url(#headerGradient)" rx="12" />
            <text x="50" y="75" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1e293b">Exam Result Sheet</text>
            <text x="50" y="105" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#3b82f6" letter-spacing="1">SASNAKA MOCK EXAM 2025</text>
            
            <image x="470" y="45" width="85" height="85" href="${qrCodeDataUrl}" />

            <!-- Profile Section -->
            <rect x="30" y="165" width="540" height="230" fill="#ffffff" stroke="#f1f5f9" stroke-width="1" rx="12"/>
            <rect x="30" y="165" width="540" height="40" fill="#f8fafc" rx="12" />
            <text x="50" y="190" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b">CANDIDATE INFORMATION</text>

            <!-- Name -->
            <text x="50" y="225" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">FULL NAME</text>
            <text x="50" y="245" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1e293b">${displayName}</text>

            <!-- Batch & District Row -->
            <text x="50" y="285" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">AL BATCH</text>
            <text x="50" y="305" font-family="Arial, sans-serif" font-size="14" fill="#334155">${batch}</text>

            <text x="300" y="285" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">DISTRICT</text>
            <text x="300" y="305" font-family="Arial, sans-serif" font-size="14" fill="#334155">${district}</text>

            <!-- Stream & Index Row -->
            <text x="50" y="345" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">SUBJECT STREAM</text>
            <text x="50" y="365" font-family="Arial, sans-serif" font-size="14" fill="#334155">${stream}</text>

            <text x="300" y="345" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">INDEX NUMBER</text>
            <text x="300" y="365" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1e293b">${index}</text>

            <!-- Center (Optional/Bottom of profile) -->
            <text x="50" y="415" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b">PREFERRED EXAM CENTER</text>
            <text x="50" y="435" font-family="Arial, sans-serif" font-size="14" fill="#334155">${examCenter}</text>

            <!-- Results Table -->
            <rect x="30" y="460" width="540" height="180" fill="#ffffff" stroke="#f1f5f9" stroke-width="1" rx="12"/>
            <rect x="30" y="460" width="540" height="40" fill="#f8fafc" rx="12"/>
            <text x="50" y="485" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b">EXAMINATION RESULTS</text>
            <text x="520" y="485" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">GRADE</text>

            ${results.map((r, i) => `
                <line x1="30" y1="${500 + (i * 45)}" x2="570" y2="${500 + (i * 45)}" stroke="#f1f5f9" stroke-width="1"/>
                <text x="50" y="${530 + (i * 45)}" font-family="Arial, sans-serif" font-size="14" fill="#1e293b">${r.subject}</text>
                <text x="520" y="${530 + (i * 45)}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${r.grade === 'A' ? '#10b981' : (r.grade === 'Absent' ? '#ef4444' : '#1e293b')}" text-anchor="middle">${r.grade}</text>
            `).join('')}

            <!-- Summary Cards Row (Z-Score & Ranks) -->
            <rect x="30" y="660" width="170" height="100" fill="#f1f5f9" rx="12" filter="url(#shadow)"/>
            <text x="115" y="690" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">FINAL Z-SCORE</text>
            <text x="115" y="730" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#2563eb" text-anchor="middle">${zscore}</text>

            <rect x="215" y="660" width="170" height="100" fill="#ffffff" stroke="#f1f5f9" rx="12"/>
            <text x="300" y="690" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">DISTRICT RANK</text>
            <text x="300" y="730" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e293b" text-anchor="middle">${districtRank}</text>

            <rect x="400" y="660" width="170" height="100" fill="#ffffff" stroke="#f1f5f9" rx="12"/>
            <text x="485" y="690" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">ISLAND RANK</text>
            <text x="485" y="730" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e293b" text-anchor="middle">${islandRank}</text>

            <!-- Footer -->
            <text x="300" y="800" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">This is an electronically generated result sheet.</text>
            <text x="300" y="820" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Verified by Sasnaka Mock Exam Result Verification System.</text>
        </svg>
        `;
    }
}

module.exports = new ResultSheetService();
