'use strict';
const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const leaders = requireRole('team_leader', 'admin');

// GET /analytics/repeated-questions — most frequent user questions
router.get('/repeated-questions', authenticate, leaders, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT lower(trim(content)) AS question, count(*) AS times,
            sum(CASE WHEN NOT answered THEN 1 ELSE 0 END) AS unanswered_times
     FROM messages
     WHERE role = 'user'
     GROUP BY lower(trim(content))
     ORDER BY times DESC
     LIMIT 50`
  );
  res.json(rows);
}));

// GET /analytics/gaps — data gaps per brand
router.get('/gaps', authenticate, leaders, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT COALESCE(b.name, '(unassigned)') AS brand,
            count(*) FILTER (WHERE g.status = 'open')     AS open,
            count(*) FILTER (WHERE g.status = 'resolved') AS resolved,
            count(*) FILTER (WHERE g.status = 'rejected') AS rejected
     FROM gap_requests g
     LEFT JOIN brands b ON b.id = g.brand_id
     GROUP BY b.name
     ORDER BY open DESC`
  );
  res.json(rows);
}));

// GET /analytics/requests — pending vs approved vs rejected info requests
router.get('/requests', authenticate, leaders, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT status, count(*) AS count FROM info_requests GROUP BY status`
  );
  res.json(rows);
}));

// GET /analytics/usage — usage per agent and per brand
router.get('/usage', authenticate, leaders, asyncHandler(async (req, res) => {
  const [perAgent, perBrand, totals] = await Promise.all([
    query(
      `SELECT u.name AS agent, count(m.id) AS questions,
              sum(CASE WHEN m.answered THEN 1 ELSE 0 END) AS answered
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN users u ON u.id = c.agent_id
       WHERE m.role = 'user'
       GROUP BY u.name ORDER BY questions DESC LIMIT 50`
    ),
    query(
      `SELECT COALESCE(b.name, '(none)') AS brand, count(m.id) AS questions
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       LEFT JOIN brands b ON b.id = c.brand_id
       WHERE m.role = 'user'
       GROUP BY b.name ORDER BY questions DESC`
    ),
    query(
      `SELECT
         count(*) FILTER (WHERE role = 'user') AS total_questions,
         count(*) FILTER (WHERE role = 'assistant' AND answered) AS answered,
         count(*) FILTER (WHERE role = 'assistant' AND NOT answered) AS unanswered
       FROM messages`
    ),
  ]);
  res.json({ perAgent: perAgent.rows, perBrand: perBrand.rows, totals: totals.rows[0] });
}));

module.exports = router;
