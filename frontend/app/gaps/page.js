'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function GapsPage() {
  const [gaps, setGaps] = useState([]);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState('open');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setError('');
    try {
      setGaps(await api(`/gaps?status=${status}`));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function resolve(id) {
    const standardAnswer = answers[id];
    if (!standardAnswer || !standardAnswer.trim()) { setError('Enter a standard answer first.'); return; }
    setBusy(id);
    try {
      await api(`/gaps/${id}`, { method: 'PATCH', body: { status: 'resolved', standardAnswer } });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  }
  async function reject(id) {
    setBusy(id);
    try {
      await api(`/gaps/${id}`, { method: 'PATCH', body: { status: 'rejected' } });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  return (
    <Shell>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Gap Requests</h2>
        <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <p className="muted">Questions the AI could not answer. Resolving one writes the approved answer into the knowledge base.</p>
      {error && <p className="error">{error}</p>}
      {gaps.length === 0 && <p className="muted">No {status} gaps.</p>}

      {gaps.map((g) => (
        <div key={g.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{g.question}</strong>
            <span className={`badge ${g.status}`}>{g.status}</span>
          </div>
          <div className="muted" style={{ fontSize: 13, margin: '6px 0' }}>
            Brand: {g.brand_name || '—'} · Raised by: {g.raised_by_name || '—'}
          </div>
          {g.status === 'open' ? (
            <>
              <label>Standard answer</label>
              <textarea
                rows={3}
                value={answers[g.id] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [g.id]: e.target.value }))}
                placeholder="Enter the approved answer to add to the knowledge base…"
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="success" disabled={busy === g.id} onClick={() => resolve(g.id)}>Approve & add to KB</button>
                <button className="danger" disabled={busy === g.id} onClick={() => reject(g.id)}>Reject</button>
              </div>
            </>
          ) : (
            g.standard_answer && <div className="muted">Answer: {g.standard_answer}</div>
          )}
        </div>
      ))}
    </Shell>
  );
}
