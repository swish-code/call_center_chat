'use strict';
// Structured data: branches & pricing. Read by anyone; written by admin.
const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();

// ── Branches ─────────────────────────────────────────────
router.get('/branches/:brandId', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM branches WHERE brand_id = $1 ORDER BY name', [req.params.brandId]);
  res.json(rows);
}));

router.post('/branches', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { brandId, name, address, city, phone, workingHours } = req.body || {};
  if (!brandId || !name) return res.status(400).json({ error: 'brandId and name required' });
  const { rows } = await query(
    `INSERT INTO branches (brand_id, name, address, city, phone, working_hours)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [brandId, name, address || null, city || null, phone || null, workingHours || null]
  );
  await audit.record({ userId: req.user.sub, action: 'create', entity: 'branch', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}));

router.delete('/branches/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM branches WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Branch not found' });
  await audit.record({ userId: req.user.sub, action: 'delete', entity: 'branch', entityId: req.params.id });
  res.status(204).end();
}));

// ── Pricing ──────────────────────────────────────────────
router.get('/pricing/:brandId', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM pricing WHERE brand_id = $1 ORDER BY item_name', [req.params.brandId]);
  res.json(rows);
}));

router.post('/pricing', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { brandId, itemName, price, currency, notes } = req.body || {};
  if (!brandId || !itemName || price == null) {
    return res.status(400).json({ error: 'brandId, itemName, price required' });
  }
  const { rows } = await query(
    `INSERT INTO pricing (brand_id, item_name, price, currency, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [brandId, itemName, price, currency || 'EGP', notes || null]
  );
  await audit.record({ userId: req.user.sub, action: 'create', entity: 'pricing', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}));

router.delete('/pricing/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM pricing WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Pricing not found' });
  await audit.record({ userId: req.user.sub, action: 'delete', entity: 'pricing', entityId: req.params.id });
  res.status(204).end();
}));

module.exports = router;
