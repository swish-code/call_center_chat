'use strict';
// Thin wrapper over the Gemini REST API using global fetch (Node 18+).
// No SDK dependency — keeps the install small and predictable.
const config = require('../config');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function ensureKey() {
  if (!config.gemini.apiKey) {
    const err = new Error('GEMINI_API_KEY is not set');
    err.status = 503;
    err.code = 'NO_GEMINI_KEY';
    throw err;
  }
}

/**
 * Embed a single text into a 768-dim vector with text-embedding-004.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embed(text) {
  ensureKey();
  const model = config.gemini.embedModel;
  const url = `${BASE}/models/${model}:embedContent?key=${config.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embed failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const values = data.embedding && data.embedding.values;
  if (!Array.isArray(values)) throw new Error('Gemini embed: unexpected response shape');
  return values;
}

/**
 * Generate an answer from Gemini given a fully-built prompt.
 * temperature is kept low to discourage creativity (we want grounded answers).
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function generate(prompt) {
  ensureKey();
  const model = config.gemini.chatModel;
  const url = `${BASE}/models/${model}:generateContent?key=${config.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini generate failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const text = data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts.map((p) => p.text).join('');
  return (text || '').trim();
}

/** Format a JS number[] as a pgvector literal: '[0.1,0.2,...]' */
function toVectorLiteral(values) {
  return `[${values.join(',')}]`;
}

module.exports = { embed, generate, toVectorLiteral };
