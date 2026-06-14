'use strict';
const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const knowledge = require('../services/knowledge');
const audit = require('../services/audit');

const router = express.Router();

// POST /gaps  — raise a gap manually (agent)
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { question, conversationId, brandId } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });
  const { rows } = await query(
    `INSERT INTO gap_requests (question, conversation_id, brand_id, raised_by, status)
     VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
    [question, conversationId || null, brandId || null, req.user.sub]
  );
  res.status(201).json(rows[0]);
}));

// GET /gaps  — team leader / admin queue (filter by ?status=open)
router.get('/', authenticate, requireRole('team_leader', 'admin'), asyncHandler(async (req, res) => {
  const status = req.query.status || 'open';
  const { rows } = await query(
    `SELECT g.*, b.name AS brand_name, u.name AS raised_by_name
     FROM gap_requests g
     LEFT JOIN brands b ON b.id = g.brand_id
     LEFT JOIN users u ON u.id = g.raised_by
     WHERE g.status = $1
     ORDER BY g.created_at DESC`,
    [status]
  );
  res.json(rows);
}));

// PATCH /gaps/:id  — resolve with a standard answer (team leader / admin)
// On resolve: writes the approved answer into the knowledge base (human-approved).
router.patch('/:id', authenticate, requireRole('team_leader', 'admin'), asyncHandler(async (req, res) => {
  const { standardAnswer, status, brandId } = req.body || {};
  const action = status || 'resolved';

  if (action === 'rejected') {
    const { rows } = await query(
      `UPDATE gap_requests SET status = 'rejected', assigned_to = $2, resolved_at = now()
       WHERE id = $1 AND status = 'open' RETURNING *`,
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Open gap not found' });
    await audit.record({ userId: req.user.sub, action: 'reject', entity: 'gap_request', entityId: req.params.id });
    return res.json(rows[0]);
  }

  // Resolve: require an answer, then add it to the KB transactionally.
  if (!standardAnswer || !standardAnswer.trim()) {
    return res.status(400).json({ error: 'standardAnswer required to resolve' });
  }
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE gap_requests
       SET status = 'resolved', standard_answer = $2, assigned_to = $3,
           brand_id = COALESCE($4, brand_id), resolved_at = now()
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [req.params.id, standardAnswer, req.user.sub, brandId || null]
    );
    const gap = rows[0];
    if (!gap) return null;
    // Store both the question and answer as a chunk for future retrieval.
    const content = `Q: ${gap.question}\nA: ${standardAnswer}`;
    await knowledge.addChunk({
      brandId: gap.brand_id, content, source: `gap:${gap.id}`, createdBy: req.user.sub,
    }, client);
    await audit.record({
      userId: req.user.sub, action: 'resolve', entity: 'gap_request', entityId: gap.id,
      details: { wroteToKb: true },
    }, client);
    return gap;
  });
  if (!result) return res.status(404).json({ error: 'Open gap not found' });
  res.json(result);
}));

module.exports = router;
