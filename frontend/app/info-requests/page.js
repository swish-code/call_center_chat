'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function InfoRequestsPage() {
  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setError('');
    try { setItems(await api(`/info-requests?status=${status}`)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  function edit(id, field, value) {
    setEdits((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));
  }

  async function approve(item) {
    setBusy(item.id);
    try {
      const e = edits[item.id] || {};
      await api(`/info-requests/${item.id}`, {
        method: 'PATCH',
        body: {
          status: 'approved',
          proposedQuestion: e.question ?? item.proposed_question,
          proposedAnswer: e.answer ?? item.proposed_answer,
        },
      });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  }
  async function reject(id) {
    setBusy(id);
    try { await api(`/info-requests/${id}`, { method: 'PATCH', body: { status: 'rejected' } }); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(null); }
  }

  return (
    <Shell>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Information Requests</h2>
        <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <p className="muted">Proposals extracted from Outlook emails or chat. Approving writes the (optionally edited) item into the knowledge base. Nothing is saved automatically.</p>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">No {status} requests.</p>}

      {items.map((it) => (
        <div key={it.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Source: {it.source}{it.source_ref ? ` (${it.source_ref.slice(0, 16)}…)` : ''} · Brand: {it.brand_name || '—'}
            </span>
            <span className={`badge ${it.status}`}>{it.status}</span>
          </div>
          {it.status === 'pending' ? (
            <>
              <label>Question (editable)</label>
              <input
                value={edits[it.id]?.question ?? it.proposed_question ?? ''}
                onChange={(e) => edit(it.id, 'question', e.target.value)}
              />
              <label>Answer (editable)</label>
              <textarea
                rows={3}
                value={edits[it.id]?.answer ?? it.proposed_answer ?? ''}
                onChange={(e) => edit(it.id, 'answer', e.target.value)}
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="success" disabled={busy === it.id} onClick={() => approve(it)}>Approve & add to KB</button>
                <button className="danger" disabled={busy === it.id} onClick={() => reject(it.id)}>Reject</button>
              </div>
            </>
          ) : (
            <div>
              {it.proposed_question && <div><strong>Q:</strong> {it.proposed_question}</div>}
              <div><strong>A:</strong> {it.proposed_answer}</div>
            </div>
          )}
        </div>
      ))}
    </Shell>
  );
}
