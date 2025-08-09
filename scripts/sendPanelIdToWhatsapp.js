const { MongoClient } = require('mongodb');
const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MAX_WHATSAPP_SENDS = parseInt(process.env.MAX_WHATSAPP_SENDS || '1', 10);

function formatSLMobile(number) {
  // Remove non-digit characters
  const digits = number.replace(/\D/g, '');
  // Replace leading 0 with +94
  if (digits.length === 10 && digits.startsWith('0')) {
    return '+94' + digits.slice(1);
  }
  return number; // Return as-is if already formatted
}

async function sendPanelIdToWhatsapp() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'sme25';
  const mongoClient = new MongoClient(uri);

  console.log('Connecting to MongoDB...');
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    const db = mongoClient.db(dbName);
    const collection = db.collection("sme25adminpanel_private");

    console.log('Fetching panel members...');
    const panelMembers = await collection.find({ panelId: { $exists: true }, WPNumber: { $exists: true, $ne: '' } }).toArray();
    console.log(`Found ${panelMembers.length} panel members`);

    for (const member of panelMembers) {
      try{
        const whatsappNumber = formatSLMobile(member.WPNumber);
        const panelId = member.panelId;
        const sentTimes = Array.isArray(member.whatsappMsgSentTimes) ? member.whatsappMsgSentTimes : [];

        if (!whatsappNumber) {
          console.warn(`No WhatsApp number for member _id: ${member._id}`);
          continue;
        }
        if (!panelId) {
          console.warn(`No panelId for member _id: ${member._id}`);
          continue;
        }


        if (whatsappNumber && panelId && sentTimes.length < MAX_WHATSAPP_SENDS) {
          console.log(`Sending WhatsApp to ${whatsappNumber} for panelId ${panelId}`);
          await client.messages.create({
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + whatsappNumber,
            body: `Your admin ID for Sasnaka Mock Exam Admin Account is: ${panelId}. 
          Please Keep this securely with you. 
          Thank you very much for you coordination - SME25 IT & Data Management Team`
          });

          // Update the document with the new send time
          await collection.updateOne(
              { _id: member._id },
              { $push: { whatsappMsgSentTimes: new Date() } }
          );

          console.log(`Sent panelId to ${whatsappNumber}`);
        } else if (sentTimes.length >= MAX_WHATSAPP_SENDS) {
          console.log(`Skipped ${whatsappNumber}: message sent ${sentTimes.length} times`);
        }
      }catch (msgError) {
        console.error(`Error sending message to member _id: ${member._id}, number: ${member.WPNumber}`, msgError);
      }
    }
  } catch (error) {
    console.error('Error sending WhatsApp messages:', error);
  } finally {
    await mongoClient.close();
    console.log('MongoDB connection closed');
  }
}

sendPanelIdToWhatsapp().catch(err => {
  console.error('Unhandled error in sendPanelIdToWhatsapp:', err);
});