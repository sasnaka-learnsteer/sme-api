require('dotenv').config();
const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const doc = await client.db(process.env.MONGODB_DB).collection('sme26registrations').findOne({ NIC: 'CURL_TEST1' });
        console.log("Candidate:", doc);
    } catch(err) { console.error(err); } finally { await client.close(); }
}
test();
