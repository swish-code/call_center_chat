'use strict';
// Microsoft Graph (Outlook) integration — Phase 4.
// Uses client-credentials OAuth (app-only) to read a shared/AI mailbox and
// turn new emails into info_requests for human review. NO automatic DB writes.
//
// Prerequisite (Entra ID app registration):
//   - Application permission: Mail.Read (admin-consented)
//   - A client secret
// Set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / GRAPH_MAILBOX.
const config = require('../config');
const { query } = require('../db/pool');
const gemini = require('./gemini');

function graphConfigured() {
  const g = config.graph;
  return Boolean(g.tenantId && g.clientId && g.clientSecret && g.mailbox);
}

async function getAccessToken() {
  const g = config.graph;
  const url = `https://login.microsoftonline.com/${g.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: g.clientId,
    client_secret: g.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Graph token failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Fetch the newest unread messages from the configured mailbox. */
async function fetchRecentMessages(token, top = 20) {
  const g = config.graph;
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(g.mailbox)}` +
    `/messages?$top=${top}&$select=id,subject,bodyPreview,body,from,receivedDateTime&$orderby=receivedDateTime desc`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph messages failed (${res.status}): ${await res.text()}`);
  return (await res.json()).value || [];
}

/**
 * Ask Gemini to extract a candidate Q/A from an email body. Returns null if the
 * email contains no useful knowledge. Output is a proposal only — never auto-saved.
 */
async function extractCandidate(email) {
  const text = (email.body && email.body.content) || email.bodyPreview || '';
  const prompt = `You extract reusable knowledge-base entries from internal company emails.
From the EMAIL below, extract ONE concise question-and-answer pair that a call
center agent might need (e.g. a price, a policy, branch info). If the email has no
such reusable fact, reply exactly: NONE.
Return strictly this format when a fact exists:
Q: <question>
A: <answer>

EMAIL SUBJECT: ${email.subject || ''}
EMAIL BODY:
${text}`;
  const out = await gemini.generate(prompt);
  if (!out || /^NONE/i.test(out.trim())) return null;
  const qMatch = out.match(/Q:\s*([\s\S]*?)\nA:/i);
  const aMatch = out.match(/A:\s*([\s\S]*)$/i);
  const question = qMatch ? qMatch[1].trim() : null;
  const answer = aMatch ? aMatch[1].trim() : out.trim();
  if (!answer) return null;
  return { question, answer };
}

/**
 * Poll the mailbox, extract candidates, and create pending info_requests.
 * Idempotent via processed_emails. Returns a summary.
 */
async function pollOnce() {
  if (!graphConfigured()) {
    return { configured: false, created: 0, message: 'Graph not configured' };
  }
  const token = await getAccessToken();
  const messages = await fetchRecentMessages(token);
  let created = 0;
  let skipped = 0;
  for (const msg of messages) {
    const seen = await query('SELECT 1 FROM processed_emails WHERE message_id = $1', [msg.id]);
    if (seen.rowCount) { skipped++; continue; }
    const candidate = await extractCandidate(msg);
    if (candidate) {
      await query(
        `INSERT INTO info_requests (source, source_ref, proposed_question, proposed_answer, status)
         VALUES ('email', $1, $2, $3, 'pending')`,
        [msg.id, candidate.question, candidate.answer]
      );
      created++;
    }
    await query('INSERT INTO processed_emails (message_id) VALUES ($1) ON CONFLICT DO NOTHING', [msg.id]);
  }
  return { configured: true, created, skipped, scanned: messages.length };
}

module.exports = { graphConfigured, pollOnce };
