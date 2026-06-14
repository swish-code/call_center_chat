'use strict';
// Standalone runner for Outlook polling — for `npm run poll:outlook` or a cron job.
const { pool } = require('../db/pool');
const outlook = require('../services/outlook');

(async () => {
  try {
    const summary = await outlook.pollOnce();
    console.log('Outlook poll:', JSON.stringify(summary));
  } catch (e) {
    console.error('Outlook poll failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
