'use strict';
const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const knowledge = require('../services/knowledge');
const audit = require('../services/audit');

const router = express.Router();

// POST /info-requests — create a proposal (from chat UI or internal callers)
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { source, sourceRef, proposedQuestion, proposedAnswer, brandId } = req.body || {};
  if (!proposedAnswer) return res.status(400).json({ error: 'proposedAnswer required' });
  const { rows } = await query(
    `INSERT INTO info_requests (source, source_ref, proposed_question, proposed_answer, brand_id, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
    [source || 'chat', sourceRef || null, proposedQuestion || null, proposedAnswer, brandId || null]
  );
  res.status(201).json(rows[0]);
}));

// GET /info-requests — review queue (team leader / admin). ?status=pending
router.get('/', authenticate, requireRole('team_leader', 'admin'), asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const { rows } = await query(
    `SELECT i.*, b.name AS brand_name
     FROM info_requests i
     LEFT JOIN brands b ON b.id = i.brand_id
     WHERE i.status = $1
     ORDER BY i.created_at DESC`,
    [status]
  );
  res.json(rows);
}));

// PATCH /info-requests/:id — approve / edit-then-approve / reject
// Only approved items enter the database. No automatic DB edits.
router.patch('/:id', authenticate, requireRole('team_leader', 'admin'), asyncHandler(async (req, res) => {
  const { status, proposedQuestion, proposedAnswer, brandId } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }

  if (status === 'rejected') {
    const { rows } = await query(
      `UPDATE info_requests SET status = 'rejected', reviewed_by = $2, reviewed_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pending request not found' });
    await audit.record({ userId: req.user.sub, action: 'reject', entity: 'info_request', entityId: req.params.id });
    return res.json(rows[0]);
  }

  // Approve: apply any edits, write to KB, mark approved — all in one transaction.
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE info_requests
       SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
           proposed_question = COALESCE($3, proposed_question),
           proposed_answer   = COALESCE($4, proposed_answer),
           brand_id          = COALESCE($5, brand_id)
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.sub, proposedQuestion || null, proposedAnswer || null, brandId || null]
    );
    const info = rows[0];
    if (!info) return null;
    const content = info.proposed_question
      ? `Q: ${info.proposed_question}\nA: ${info.proposed_answer}`
      : info.proposed_answer;
    await knowledge.addChunk({
      brandId: info.brand_id, content, source: `info:${info.id}`, createdBy: req.user.sub,
    }, client);
    await audit.record({
      userId: req.user.sub, action: 'approve', entity: 'info_request', entityId: info.id,
      details: { source: info.source, sourceRef: info.source_ref, wroteToKb: true },
    }, client);
    return info;
  });
  if (!result) return res.status(404).json({ error: 'Pending request not found' });
  res.json(result);
}));

module.exports = router;
