'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const config = require('../config');
const notify = require('../services/notify');

const router = express.Router();

// GET /notifications/stream — SSE live feed. Token via query (EventSource
// cannot set Authorization headers).
router.get('/stream', (req, res) => {
  let user;
  try { user = jwt.verify(req.query.token, config.jwtSecret); } catch (e) { return res.status(401).end(); }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  notify.addClient(user.sub, res);
  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(hb); notify.removeClient(user.sub, res); });
});

// GET /notifications — current user's notifications + unread count
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, type, title, body, link, read, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.sub]
  );
  res.json({ notifications: rows, unread: rows.filter((r) => !r.read).length });
}));

router.post('/:id/read', authenticate, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub]);
  res.json({ ok: true });
}));

router.post('/read-all', authenticate, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [req.user.sub]);
  res.json({ ok: true });
}));

router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub]);
  res.status(204).end();
}));

module.exports = router;
