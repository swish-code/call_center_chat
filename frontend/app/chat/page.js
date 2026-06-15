'use client';
import { useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getUser } from '@/lib/api';

export default function ChatPage() {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const endRef = useRef(null);
  const [user] = useState(() => (typeof window !== 'undefined' ? getUser() : null));

  useEffect(() => {
    api('/brands').then((bs) => {
      setBrands(bs);
      if (bs.length) setBrandId((cur) => cur || String(bs[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  // Load saved conversations so the chat survives a refresh and can be revisited any day.
  async function loadHistory(autoOpenLatest) {
    if (!user) return;
    try {
      const h = await api(`/chat/history/${user.id}`);
      const convs = (h || [])
        .map((c) => ({ ...c, messages: (c.messages || []).filter(Boolean) }))
        .filter((c) => c.messages.length);
      setHistory(convs);
      if (autoOpenLatest && convs.length) {
        setConversationId((cur) => {
          if (cur) return cur;
          openConversation(convs[0]);
          return convs[0].conversation_id;
        });
      }
    } catch (e) { /* history is best-effort */ }
  }
  useEffect(() => { loadHistory(true); /* eslint-disable-next-line */ }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function openConversation(c) {
    setConversationId(c.conversation_id);
    setMessages(c.messages.map((m) => ({
      role: m.role, content: m.content, answered: m.answered, confidence: m.confidence,
    })));
  }
  function newChat() { setConversationId(null); setMessages([]); setError(''); }

  async function send(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput('');
    setError('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await api('/chat', {
        method: 'POST',
        body: { question, brandId: brandId || undefined, conversationId: conversationId || undefined },
      });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, {
        role: 'assistant', content: res.answer, answered: res.answered,
        confidence: res.confidence, gapRequestId: res.gapRequestId,
      }]);
      loadHistory(false); // refresh the saved-conversation list
    } catch (err) {
      setError(err.message);
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${err.message}`, answered: false }]);
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByDay(history);

  return (
    <Shell>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>AI Chat</h2>
        <div style={{ width: 240 }}>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', marginTop: 8 }}>
        {/* Saved conversations, grouped by day */}
        <aside style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: '72vh', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,.08)', paddingRight: 12 }}>
          <button type="button" onClick={newChat} style={{ width: '100%' }}>+ محادثة جديدة</button>
          {groups.length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا توجد محادثات محفوظة بعد.</p>}
          {groups.map((g) => (
            <div key={g.key}>
              <div className="muted" style={{ fontSize: 11, letterSpacing: 1, margin: '10px 0 4px' }}>{g.label}</div>
              {g.items.map((c) => (
                <button key={c.conversation_id} type="button" onClick={() => openConversation(c)}
                  className={c.conversation_id === conversationId ? '' : 'ghost'}
                  style={{ width: '100%', textAlign: 'right', fontSize: 13, padding: '8px 10px', marginBottom: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {firstQuestion(c)}
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>{timeOf(c)}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Chat window */}
        <div className="chat-window" style={{ flex: 1 }}>
          <div className="messages">
            {messages.length === 0 && (
              <p className="muted">Ask a question in Arabic or English. The AI answers only from the approved knowledge base.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}${m.role === 'assistant' && m.answered === false ? ' refusal' : ''}`}>
                {m.content}
                {m.role === 'assistant' && m.confidence != null && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    confidence: {Number(m.confidence).toFixed(2)}
                    {m.gapRequestId && ' · gap ticket opened for Team Leader'}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="msg assistant muted">…thinking</div>}
            <div ref={endRef} />
          </div>

          {error && <p className="error">{error}</p>}
          <form className="composer" onSubmit={send}>
            <input placeholder="Type your question… / اكتب سؤالك" value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" disabled={loading}>Send</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}

// ── helpers ───────────────────────────────────────────────
function dayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }
function dayLabel(ts) {
  const d = new Date(ts); const now = new Date();
  const k = dayKey(ts);
  if (k === dayKey(now)) return 'اليوم';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (k === dayKey(y)) return 'أمس';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}
function groupByDay(history) {
  const map = new Map();
  for (const c of history) {
    const k = dayKey(c.created_at);
    if (!map.has(k)) map.set(k, { key: k, label: dayLabel(c.created_at), items: [] });
    map.get(k).items.push(c);
  }
  return [...map.values()];
}
function firstQuestion(c) {
  const u = c.messages.find((m) => m.role === 'user');
  const t = (u && u.content) || '(محادثة)';
  return t.length > 32 ? t.slice(0, 32) + '…' : t;
}
function timeOf(c) {
  return new Date(c.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
