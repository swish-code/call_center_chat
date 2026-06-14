'use strict';
const { query } = require('../db/pool');

/**
 * Append an entry to the audit trail. Never throws into the request path —
 * audit failures are logged, not surfaced.
 * @param {object} client optional pg client (to run inside a transaction)
 */
async function record({ userId, action, entity, entityId, details }, client) {
  const runner = client || { query };
  try {
    await runner.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, entity, entityId != null ? String(entityId) : null, details || null]
    );
  } catch (e) {
    console.error('audit.record failed:', e.message);
  }
}

module.exports = { record };
