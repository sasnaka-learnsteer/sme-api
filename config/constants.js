// config/constants.js
// Static reference data for Sri Lanka administrative divisions

/**
 * All 9 provinces of Sri Lanka
 */
const PROVINCES = [
    'Western',
    'Central',
    'Southern',
    'Northern',
    'Eastern',
    'North Western',
    'North Central',
    'Uva',
    'Sabaragamuwa',
];

/**
 * All 25 districts of Sri Lanka, grouped by province
 */
const DISTRICTS_BY_PROVINCE = {
    'Western':       ['Colombo', 'Gampaha', 'Kalutara'],
    'Central':       ['Kandy', 'Matale', 'Nuwara Eliya'],
    'Southern':      ['Galle', 'Matara', 'Hambantota'],
    'Northern':      ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'],
    'Eastern':       ['Trincomalee', 'Batticaloa', 'Ampara'],
    'North Western': ['Kurunegala', 'Puttalam'],
    'North Central': ['Anuradhapura', 'Polonnaruwa'],
    'Uva':           ['Badulla', 'Monaragala'],
    'Sabaragamuwa':  ['Ratnapura', 'Kegalle'],
};

/**
 * Flat list of all 25 districts
 */
const DISTRICTS = Object.values(DISTRICTS_BY_PROVINCE).flat();

module.exports = {
    PROVINCES,
    DISTRICTS,
    DISTRICTS_BY_PROVINCE,
};
