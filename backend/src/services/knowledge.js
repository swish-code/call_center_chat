'use strict';
// Central place that writes to the knowledge base. Embeds then inserts.
// Used by: admin knowledge CRUD, gap resolution, info-request approval.
// (The AI never calls this directly — only human-approved flows do.)
const { query } = require('../db/pool');
const gemini = require('./gemini');
const retrieval = require('./retrieval');

/**
 * Embed `content` and insert one knowledge chunk.
 * @param {object} client optional pg client for transactional use
 * @returns {Promise<object>} the inserted row (without embedding)
 */
async function addChunk({ brandId, content, language, source, createdBy }, client) {
  const runner = client || { query };
  const lang = language || retrieval.detectLanguage(content);
  const vec = await gemini.embed(content);
  const literal = gemini.toVectorLiteral(vec);
  const { rows } = await runner.query(
    `INSERT INTO knowledge_chunks (brand_id, language, content, embedding, source, created_by)
     VALUES ($1, $2, $3, $4::vector, $5, $6)
     RETURNING id, brand_id, language, content, source, created_by, created_at`,
    [brandId || null, lang, content, literal, source || 'manual', createdBy || null]
  );
  return rows[0];
}

module.exports = { addChunk };
