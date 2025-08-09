// scripts/insertExams.js
const { MongoClient } = require('mongodb');
const { MONGODB_URI, MONGODB_DB } = require('../config/env');

const exams = [
  {
    exam_name: 'Combined Maths I',
    paper_id: 10,
    date: '2025-08-16',
    day: 'Saturday',
    time: '8:30 am - 11:40 am'
  },
  {
    exam_name: 'Biology II',
    paper_id: 3,
    date: '2025-08-16',
    day: 'Saturday',
    time: '8:30 am - 11:40 am'
  },
  {
    exam_name: 'Biology I',
    paper_id: 3,
    date: '2025-08-16',
    day: 'Saturday',
    time: '12:40 pm - 2:40 pm'
  },
  {
    exam_name: 'Combined Maths II',
    paper_id: 10,
    date: '2025-08-16',
    day: 'Saturday',
    time: '12:40 pm - 3:50 pm'
  },
  {
    exam_name: 'Chemistry II',
    paper_id: 2,
    date: '2025-08-17',
    day: 'Sunday',
    time: '8:30 am - 11:40 am'
  },
  {
    exam_name: 'Chemistry I',
    paper_id: 2,
    date: '2025-08-17',
    day: 'Sunday',
    time: '12:40 pm - 2:40 pm'
  },
  {
    exam_name: 'Physics II',
    paper_id: 1,
    date: '2025-08-24',
    day: 'Sunday',
    time: '8:30 am - 11:40 am'
  },
  {
    exam_name: 'Physics I',
    paper_id: 1,
    date: '2025-08-24',
    day: 'Sunday',
    time: '12:40 pm - 2:40 pm'
  }
];

async function insertExams() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const collection = db.collection(process.env.EXAMS_MONGO_COLLECTION);
    await collection.insertMany(exams);
    console.log('Inserted 8 exam documents to the collection');
  } finally {
    await client.close();
  }
}

insertExams();