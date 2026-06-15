'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole, signToken } = require('../middleware/auth');
const audit = require('../services/audit');

const router = express.Router();

// POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { rows } = await query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// POST /auth/register  (admin only)
router.post('/register', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, password required' });
  }
  const allowed = ['agent', 'team_leader', 'admin'];
  const r = allowed.includes(role) ? role : 'agent';
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
      [name, email, hash, r]
    );
    await audit.record({ userId: req.user.sub, action: 'create', entity: 'user', entityId: rows[0].id });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
}));

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role });
});

// GET /auth/users  (admin) — simple user listing
router.get('/users', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC');
  res.json(rows);
}));

const ROLES = ['agent', 'team_leader', 'admin'];

// PATCH /auth/users/:id  (admin) — edit name / role / active / password
router.patch('/users/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role, active, password } = req.body || {};
  // Lockout protection: an admin cannot disable or demote their own account.
  if (id === req.user.sub && (active === false || (role && role !== 'admin'))) {
    return res.status(400).json({ error: 'You cannot disable or demote your own account' });
  }
  const sets = [];
  const params = [];
  if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    params.push(role); sets.push(`role = $${params.length}`);
  }
  if (active !== undefined) { params.push(!!active); sets.push(`active = $${params.length}`); }
  if (password) { params.push(await bcrypt.hash(password, 10)); sets.push(`password_hash = $${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, email, role, active, created_at`, params);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  await audit.record({ userId: req.user.sub, action: 'update', entity: 'user', entityId: id });
  res.json(rows[0]);
}));

// DELETE /auth/users/:id  (admin)
router.delete('/users/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.sub) return res.status(400).json({ error: 'You cannot delete your own account' });
  try {
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'User has linked activity; disable the account instead of deleting.' });
    throw e;
  }
  await audit.record({ userId: req.user.sub, action: 'delete', entity: 'user', entityId: id });
  res.status(204).end();
}));

module.exports = router;
