const { syncData, cleanCollection } = require('../../scheduler/dataSyncToMongo_scheduled.js');

export default async function handler(req, res) {
  // Verify this is a cron request (Vercel adds headers for cron jobs)
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Running sync data task:', new Date().toISOString());

    // Run the sync operation
    await syncData();

    console.log('Data sync completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Data sync completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Data sync scheduler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
