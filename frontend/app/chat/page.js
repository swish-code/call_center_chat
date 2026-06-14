'use client';
import { useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function ChatPage() {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    api('/brands').then(setBrands).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        role: 'assistant',
        content: res.answer,
        answered: res.answered,
        confidence: res.confidence,
        gapRequestId: res.gapRequestId,
      }]);
    } catch (err) {
      setError(err.message);
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${err.message}`, answered: false }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>AI Chat</h2>
        <div style={{ width: 240 }}>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="chat-window">
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
          <input
            placeholder="Type your question… / اكتب سؤالك"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={loading}>Send</button>
        </form>
      </div>
    </Shell>
  );
}
