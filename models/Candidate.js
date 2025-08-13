const mongoose = require('mongoose');
const {MONGODB_COLLECTION} = require("../config/env");

const candidateSchema = new mongoose.Schema({
    // Personal Information
    'Full Name': {
        type: String,
        required: true,
        trim: true
    },
    'NIC': {
        type: String,
        required: false,
        unique: false,
        trim: true
    },
    'Whatsapp Number': {
        type: String,
        required: false,
        trim: true
    },
    'Email Address': {
        type: String,
        required: false,
        trim: true,
        lowercase: true
    },

    // Exam Information
    'Preferred Exam Center': {
        type: String,
        required: false,
        enum: ['Colombo', 'Kandy', 'Galle'],
        trim: true
    },

    // Participation Status
    'participation_status': {
        type: String,
        enum: ['pending', 'confirmed', 'rejected', 'not_reachable'],
        default: 'pending'
    },
    'participation_confirmed_date': {
        type: Date
    },
    'participation_notes': {
        type: String,
        trim: true
    },

    // QR Code and Check-in
    'qrCode': {
        type: String,
        unique: false,
        sparse: true // Allows multiple null values
    },

}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: MONGODB_COLLECTION
});

// Indexes for better query performance
candidateSchema.index({ 'Preferred Exam Center': 1 });
candidateSchema.index({ 'participation_status': 1 });
candidateSchema.index({ 'Preferred Exam Center': 1, 'participation_status': 1 });
candidateSchema.index({ 'NIC': 1 });
candidateSchema.index({ 'qr_code': 1 });

// Pre-save middleware to generate Application ID
// candidateSchema.pre('save', async function(next) {
//     if (this.isNew && !this['Application ID']) {
//         const count = await this.constructor.countDocuments();
//         this['Application ID'] = `SME-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
//     }
//     next();
// });

// Static method for dashboard calculations
candidateSchema.statics.getDashboardStats = async function() {
    const centers = ['Colombo', 'Kandy', 'Galle'];
    const result = {};

    for (const center of centers) {
        const centerKey = center.toLowerCase();

        const [total, confirmed, rejected, not_reachable] = await Promise.all([
            this.countDocuments({ 'Preferred Exam Center': center }),
            this.countDocuments({ 'Preferred Exam Center': center, 'participation_status': 'confirmed' }),
            this.countDocuments({ 'Preferred Exam Center': center, 'participation_status': 'rejected' }),
            this.countDocuments({ 'Preferred Exam Center': center, 'participation_status': 'not_reachable' })
        ]);

        result[centerKey] = { total, confirmed, rejected, not_reachable };
    }

    return result;
};

// Instance method to add contact attempt
// candidateSchema.methods.addContactAttempt = function(method, status, notes, contactedBy) {
//     this.contact_attempts.push({
//         method,
//         status,
//         notes,
//         contacted_by: contactedBy
//     });
//     return this.save();
// };

// Instance method to update participation status
// candidateSchema.methods.updateParticipationStatus = function(status, notes, updatedBy) {
//     this.participation_status = status;
//     this.participation_notes = notes;
//     this.status_updated_by = updatedBy;
//     this.status_updated_at = new Date();
//
//     if (status === 'confirmed') {
//         this.participation_confirmed_date = new Date();
//     }
//
//     return this.save();
// };

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate;