// velocityCalculator.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function calculateCenterVelocity() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection('sme25registrations');

    // Get all exam centers
    const centers = await collection.distinct('Preferred Exam Center');

    const predictions = {};

    for (const center of centers) {
      // Get registrations for this center, sorted by timestamp
      const registrations = await collection.find({ 'Preferred Exam Center': center })
        .sort({ Timestamp: 1 })
        .toArray();

      const currentCount = registrations.length;

      // If already full or no registrations, handle accordingly
      if (currentCount >= 400) {
        predictions[center] = {
          status: 'FULL',
          currentCount,
          predictedDate: null,
          remainingSeats: 0
        };
        continue;
      }

      if (currentCount === 0) {
        predictions[center] = {
          status: 'NO_DATA',
          currentCount: 0,
          predictedDate: null,
          remainingSeats: 400
        };
        continue;
      }

      // Calculate velocity (registrations per day)
      const firstTimestamp = new Date(registrations[0].Timestamp);
      const lastTimestamp = new Date(registrations[registrations.length - 1].Timestamp);

      // Calculate days between first and last registration
      const daysDifference = (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24);

      // Handle case where all registrations happened on same day
      const velocity = daysDifference === 0 ?
        currentCount : // If all on same day, use count as velocity
        currentCount / Math.max(1, daysDifference); // Registrations per day

      const remainingSeats = 400 - currentCount;
      const daysToFill = remainingSeats / velocity;

      // Calculate predicted date
      const predictedDate = new Date(lastTimestamp);
      predictedDate.setDate(predictedDate.getDate() + daysToFill);

      predictions[center] = {
        status: 'FILLING',
        currentCount,
        predictedDate,
        remainingSeats,
        registrationsPerDay: parseFloat(velocity.toFixed(2))
      };
    }

    return predictions;
  } finally {
    await client.close();
  }
}

module.exports = { calculateCenterVelocity };