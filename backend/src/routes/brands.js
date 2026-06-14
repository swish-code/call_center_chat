'use strict';
const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();

// GET /brands  (any authenticated user)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name, description, created_at FROM brands ORDER BY name');
  res.json(rows);
}));

// POST /brands  (admin)
router.post('/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await query(
      'INSERT INTO brands (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    await audit.record({ userId: req.user.sub, action: 'create', entity: 'brand', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Brand already exists' });
    throw e;
  }
}));

// PATCH /brands/:id  (admin)
router.patch('/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  const { rows } = await query(
    `UPDATE brands SET name = COALESCE($2, name), description = COALESCE($3, description)
     WHERE id = $1 RETURNING *`,
    [req.params.id, name || null, description || null]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Brand not found' });
  await audit.record({ userId: req.user.sub, action: 'update', entity: 'brand', entityId: req.params.id });
  res.json(rows[0]);
}));

// DELETE /brands/:id  (admin)
router.delete('/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM brands WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Brand not found' });
  await audit.record({ userId: req.user.sub, action: 'delete', entity: 'brand', entityId: req.params.id });
  res.status(204).end();
}));

module.exports = router;
