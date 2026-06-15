'use strict';
// Real-time notifications over Server-Sent Events (SSE).
// Keeps an in-memory registry of connected clients per user and pushes events.
const { query } = require('../db/pool');

const clients = new Map(); // userId -> Set<res>

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}
function removeClient(userId, res) {
  const set = clients.get(userId);
  if (set) { set.delete(res); if (!set.size) clients.delete(userId); }
}
function push(userId, payload) {
  const set = clients.get(userId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(data); } catch (e) { /* dropped */ } }
}

/** Persist a notification for one user and push it live if connected. */
async function notifyUser({ userId, type, title, body, link }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, title, body, link, read, created_at`,
    [userId, type || null, title || null, body || null, link || null]
  );
  push(userId, { notification: rows[0] });
  return rows[0];
}

/** Notify every active user holding one of the given roles. */
async function notifyRoles(roles, payload) {
  const { rows } = await query(
    `SELECT id FROM users WHERE role = ANY($1::user_role[]) AND active = TRUE`, [roles]
  );
  for (const u of rows) {
    try { await notifyUser({ ...payload, userId: u.id }); } catch (e) { /* keep going */ }
  }
}

module.exports = { addClient, removeClient, notifyUser, notifyRoles };
