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

module.exports = router;
