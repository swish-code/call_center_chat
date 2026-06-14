'use strict';
require('dotenv').config();

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/callcenter',
  databaseSsl: String(process.env.DATABASE_SSL || 'false').toLowerCase() === 'require',

  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    embedModel: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
    embedDim: num(process.env.GEMINI_EMBED_DIM, 768),
    chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash',
  },

  // Which provider writes the final RAG answer. Defaults to Claude when an
  // Anthropic key is present, otherwise Gemini. Embeddings always use Gemini.
  answerProvider: process.env.ANSWER_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'claude' : 'gemini'),
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANSWER_MODEL || 'claude-opus-4-8',
  },

  retrieval: {
    threshold: num(process.env.SIMILARITY_THRESHOLD, 0.75),
    topK: num(process.env.RETRIEVAL_TOP_K, 6),
  },

  graph: {
    tenantId: process.env.GRAPH_TENANT_ID || '',
    clientId: process.env.GRAPH_CLIENT_ID || '',
    clientSecret: process.env.GRAPH_CLIENT_SECRET || '',
    mailbox: process.env.GRAPH_MAILBOX || '',
  },

  jobsSecret: process.env.JOBS_SECRET || 'dev-jobs-secret',
};

module.exports = config;
