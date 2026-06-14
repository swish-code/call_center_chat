'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [repeated, setRepeated] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [requests, setRequests] = useState([]);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/analytics/repeated-questions'),
      api('/analytics/gaps'),
      api('/analytics/requests'),
      api('/analytics/usage'),
    ]).then(([r, g, rq, u]) => {
      setRepeated(r); setGaps(g); setRequests(rq); setUsage(u);
    }).catch((e) => setError(e.message));
  }, []);

  const reqMap = Object.fromEntries(requests.map((r) => [r.status, r.count]));

  return (
    <Shell>
      <h2>Dashboard</h2>
      {error && <p className="error">{error}</p>}

      {usage && (
        <div className="row" style={{ gap: 16, marginBottom: 16 }}>
          <div className="card" style={{ flex: 1, marginBottom: 0 }}>
            <div className="muted">Total questions</div>
            <div className="stat">{usage.totals?.total_questions || 0}</div>
          </div>
          <div className="card" style={{ flex: 1, marginBottom: 0 }}>
            <div className="muted">Answered</div>
            <div className="stat" style={{ color: 'var(--green)' }}>{usage.totals?.answered || 0}</div>
          </div>
          <div className="card" style={{ flex: 1, marginBottom: 0 }}>
            <div className="muted">Unanswered (gaps)</div>
            <div className="stat" style={{ color: 'var(--amber)' }}>{usage.totals?.unanswered || 0}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Info requests</h3>
        <div className="row" style={{ gap: 24 }}>
          <div><span className="badge pending">pending</span> {reqMap.pending || 0}</div>
          <div><span className="badge approved">approved</span> {reqMap.approved || 0}</div>
          <div><span className="badge rejected">rejected</span> {reqMap.rejected || 0}</div>
        </div>
      </div>

      <div className="card">
        <h3>Most repeated questions</h3>
        <table>
          <thead><tr><th>Question</th><th>Times</th><th>Unanswered</th></tr></thead>
          <tbody>
            {repeated.slice(0, 15).map((r, i) => (
              <tr key={i}><td>{r.question}</td><td>{r.times}</td><td>{r.unanswered_times}</td></tr>
            ))}
            {repeated.length === 0 && <tr><td colSpan={3} className="muted">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Gaps per brand</h3>
        <table>
          <thead><tr><th>Brand</th><th>Open</th><th>Resolved</th><th>Rejected</th></tr></thead>
          <tbody>
            {gaps.map((g, i) => (
              <tr key={i}><td>{g.brand}</td><td>{g.open}</td><td>{g.resolved}</td><td>{g.rejected}</td></tr>
            ))}
            {gaps.length === 0 && <tr><td colSpan={4} className="muted">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {usage && (
        <div className="card">
          <h3>Usage per agent</h3>
          <table>
            <thead><tr><th>Agent</th><th>Questions</th><th>Answered</th></tr></thead>
            <tbody>
              {usage.perAgent.map((a, i) => (
                <tr key={i}><td>{a.agent}</td><td>{a.questions}</td><td>{a.answered}</td></tr>
              ))}
              {usage.perAgent.length === 0 && <tr><td colSpan={3} className="muted">No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
