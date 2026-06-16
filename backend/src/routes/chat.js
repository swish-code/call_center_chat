'use strict';
const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const config = require('../config');
const retrieval = require('../services/retrieval');
const llm = require('../services/llm');
const notify = require('../services/notify');
const { buildRagPrompt, noDataMessage } = require('../services/prompt');

// Alert leaders/admins when a gap is auto-opened from the chat flow.
function alertGap(question, agentName) {
  notify.notifyRoles(['admin', 'team_leader'], {
    type: 'gap_new', title: String(question).slice(0, 90),
    body: `New gap request from ${agentName}`, link: '/gaps',
  }).catch(() => {});
}

const router = express.Router();

/**
 * POST /chat
 * body: { question, brandId?, conversationId? }
 * Flow:
 *   1. embed + vector search (+ structured data)
 *   2. confidence gate: top similarity < THRESHOLD => refuse + open gap
 *   3. otherwise call Gemini with strict prompt
 *   4. log conversation + messages
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { question, brandId, replyTo } = req.body || {};
  let { conversationId } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'question required' });

  const lang = retrieval.detectLanguage(question);
  // When replying to an earlier message, fold its text into the retrieval query
  // so follow-ups ("and its price?") still find the right content.
  const reply = replyTo ? String(replyTo).slice(0, 600) : null;
  const searchText = reply ? `${reply}\n${question}` : question;

  // Ensure a conversation exists for this agent.
  if (!conversationId) {
    const { rows } = await query(
      'INSERT INTO conversations (agent_id, brand_id) VALUES ($1, $2) RETURNING id',
      [req.user.sub, brandId || null]
    );
    conversationId = rows[0].id;
  }

  // Log the user message.
  await query(
    `INSERT INTO messages (conversation_id, role, content, language) VALUES ($1, 'user', $2, $3)`,
    [conversationId, question, lang]
  );

  // 1. Retrieve.
  const chunks = await retrieval.searchChunks(searchText, brandId);
  const topSimilarity = chunks.length ? Number(chunks[0].similarity) : 0;

  // 2. Confidence gate — refuse below threshold and open a gap ticket.
  if (topSimilarity < config.retrieval.threshold) {
    const refusal = noDataMessage(lang);
    const gap = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO messages (conversation_id, role, content, language, retrieved_confidence, answered)
         VALUES ($1, 'assistant', $2, $3, $4, FALSE)`,
        [conversationId, refusal, lang, topSimilarity]
      );
      const { rows } = await client.query(
        `INSERT INTO gap_requests (question, conversation_id, brand_id, raised_by, status)
         VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
        [question, conversationId, brandId || null, req.user.sub]
      );
      return rows[0];
    });
    alertGap(question, req.user.name);
    return res.json({
      conversationId,
      answer: refusal,
      answered: false,
      confidence: topSimilarity,
      gapRequestId: gap.id,
    });
  }

  // 3. Build context + ask Gemini.
  // Enrich with structured data for the selected brand, or — when on "All
  // brands" — for a brand detected in the question text (so counts/prices for
  // "كم فرع ليلو بيتزا" are exact even without using the filter).
  const structuredBrandId = brandId || (await retrieval.detectBrandId(searchText));
  const structured = await retrieval.fetchStructured(structuredBrandId);
  const context = retrieval.buildContext(chunks, structured);
  const prompt = buildRagPrompt({ context, question, lang, replyTo: reply });
  const answer = await llm.generate(prompt);

  // The model may still refuse if context doesn't actually contain the answer.
  const refusedByModel = answer.includes(noDataMessage(lang)) || answer.toLowerCase().includes('no data available');

  await query(
    `INSERT INTO messages (conversation_id, role, content, language, retrieved_confidence, answered)
     VALUES ($1, 'assistant', $2, $3, $4, $5)`,
    [conversationId, answer, lang, topSimilarity, !refusedByModel]
  );

  // If the model refused despite passing the gate, still open a gap.
  let gapRequestId = null;
  if (refusedByModel) {
    const { rows } = await query(
      `INSERT INTO gap_requests (question, conversation_id, brand_id, raised_by, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [question, conversationId, brandId || null, req.user.sub]
    );
    gapRequestId = rows[0].id;
    alertGap(question, req.user.name);
  }

  res.json({
    conversationId,
    answer,
    answered: !refusedByModel,
    confidence: topSimilarity,
    gapRequestId,
    sources: chunks.map((c) => ({ id: c.id, similarity: Number(c.similarity), preview: c.content.slice(0, 120) })),
  });
}));

// GET /chat/history/:agentId  — recent conversations + messages
router.get('/history/:agentId', authenticate, asyncHandler(async (req, res) => {
  // Agents can only read their own history; leaders/admins can read anyone's.
  if (req.user.role === 'agent' && req.user.sub !== req.params.agentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows } = await query(
    `SELECT c.id AS conversation_id, c.created_at,
            json_agg(json_build_object(
              'role', m.role, 'content', m.content, 'answered', m.answered,
              'confidence', m.retrieved_confidence, 'created_at', m.created_at
            ) ORDER BY m.created_at) AS messages
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.agent_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT 50`,
    [req.params.agentId]
  );
  res.json(rows);
}));

module.exports = router;
