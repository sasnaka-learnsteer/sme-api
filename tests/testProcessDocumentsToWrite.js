// testProcessDocumentsToWrite.js
const { RegisteredDataScheduler } = require('../scheduler/write_to_google_sheet');

(async () => {
  const scheduler = new RegisteredDataScheduler();
  await scheduler.processDocumentsToWrite();
  console.log('processDocumentsToWrite() finished');
})();