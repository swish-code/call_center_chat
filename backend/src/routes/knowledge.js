'use strict';
const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const knowledge = require('../services/knowledge');
const audit = require('../services/audit');

const router = express.Router();

// GET /knowledge/:brandId  — list chunks for a brand (no embeddings)
router.get('/:brandId', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, brand_id, language, content, source, created_at
     FROM knowledge_chunks WHERE brand_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [req.params.brandId]
  );
  res.json(rows);
}));

// POST /knowledge  (admin) — add a chunk directly (embeds on insert)
router.post('/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { brandId, content, language, source } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  const row = await knowledge.addChunk({
    brandId, content, language, source: source || 'manual', createdBy: req.user.sub,
  });
  await audit.record({ userId: req.user.sub, action: 'create', entity: 'knowledge_chunk', entityId: row.id });
  res.status(201).json(row);
}));

// DELETE /knowledge/chunk/:id  (admin)
router.delete('/chunk/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM knowledge_chunks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Chunk not found' });
  await audit.record({ userId: req.user.sub, action: 'delete', entity: 'knowledge_chunk', entityId: req.params.id });
  res.status(204).end();
}));

module.exports = router;
