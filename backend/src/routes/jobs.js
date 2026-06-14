'use strict';
// Internal jobs. Protected by a shared secret (X-Jobs-Secret header) so a cron
// scheduler (Railway cron, GitHub Actions, etc.) can trigger polling.
const express = require('express');
const { asyncHandler } = require('../middleware/error');
const config = require('../config');
const outlook = require('../services/outlook');

const router = express.Router();

function requireJobsSecret(req, res, next) {
  if ((req.headers['x-jobs-secret'] || '') !== config.jobsSecret) {
    return res.status(401).json({ error: 'Invalid jobs secret' });
  }
  next();
}

// POST /jobs/poll-outlook
router.post('/poll-outlook', requireJobsSecret, asyncHandler(async (req, res) => {
  const summary = await outlook.pollOnce();
  res.json(summary);
}));

module.exports = router;
