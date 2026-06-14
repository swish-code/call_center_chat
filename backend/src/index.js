'use strict';
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check (used by Railway).
app.get('/health', (req, res) => res.json({ status: 'ok', env: config.env }));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/brands', require('./routes/brands'));
app.use('/knowledge', require('./routes/knowledge'));
app.use('/', require('./routes/structured'));          // /branches/:id, /pricing/:id
app.use('/chat', require('./routes/chat'));
app.use('/gaps', require('./routes/gaps'));
app.use('/info-requests', require('./routes/infoRequests'));
app.use('/analytics', require('./routes/analytics'));
app.use('/jobs', require('./routes/jobs'));

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Call Center AI API listening on :${config.port} (${config.env})`);
  if (!config.gemini.apiKey) {
    console.warn('⚠  GEMINI_API_KEY is not set — chat & embeddings will return 503 until you add it.');
  }
});

module.exports = app;
