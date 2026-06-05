require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

async function test() {
    const token = jwt.sign({ panelId: '12345', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log("Token generated:", token.substring(0, 20) + "...");

    // Make request to the locally running server
    try {
        const fetch = require('node-fetch');
        const res = await fetch('http://localhost:3001/api/admin/candidate-update-exam-center-admin', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                NIC: 'CURL_TEST1', // This was inserted earlier
                newExamCenter: 'Kurunegala'
            })
        });
        
        const data = await res.json();
        console.log("Response:", res.status, data);
    } catch(err) {
        console.error(err);
    }
}
test();
