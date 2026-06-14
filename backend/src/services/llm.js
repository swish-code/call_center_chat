'use strict';
// Answer-generation layer. Picks the provider for the final RAG answer:
//   ANSWER_PROVIDER=claude  -> Anthropic Messages API (recommended)
//   ANSWER_PROVIDER=gemini  -> Gemini generateContent (fallback)
// Embeddings always stay on Gemini (see services/gemini.js); this only swaps
// the model that writes the final answer from retrieved context.
const config = require('../config');
const gemini = require('./gemini');

async function generateWithClaude(prompt) {
  if (!config.anthropic.apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not set');
    err.status = 503;
    err.code = 'NO_ANTHROPIC_KEY';
    throw err;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: 1024,
      // The full strict RAG prompt (instructions + context + question) is the
      // user turn. No temperature/top_p — removed on Opus 4.7/4.8 (would 400).
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude generate failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return (text || '').trim();
}

/** Generate the final answer from a fully-built RAG prompt. */
async function generate(prompt) {
  if (config.answerProvider === 'claude') return generateWithClaude(prompt);
  return gemini.generate(prompt);
}

module.exports = { generate };
