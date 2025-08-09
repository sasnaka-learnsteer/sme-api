const { assignCandidatesToPanelMembers } = require('../../utils/candidateAssignment');

export default async function handler(req, res) {
  // Verify this is a cron request (Vercel adds headers for cron jobs)
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // try {
  //   console.log('Running daily candidate assignment task:', new Date().toISOString());
  //   const result = await assignCandidatesToPanelMembers();
  //   console.log('Assignment result:', result);
  //
  //   if (!result.success) {
  //     console.error('Assignment FAILED:', result.message);
  //     return res.status(500).json({
  //       success: false,
  //       message: result.message
  //     });
  //   } else if (result.assignedCount > 0) {
  //     console.log(`Assignment SUCCESS: ${result.assignedCount} candidates assigned`);
  //   }
  //
  //   return res.status(200).json({
  //     success: true,
  //     message: 'Daily assignment completed',
  //     assignedCount: result.assignedCount || 0
  //   });
  // } catch (error) {
  //   console.error('Candidate assignment scheduler error:', error);
  //   return res.status(500).json({
  //     success: false,
  //     error: error.message
  //   });
  // }
}
