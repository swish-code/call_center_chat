'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, API_BASE } from '@/lib/api';

// Bell + live notification panel. Connects to the SSE stream, shows an unread
// badge, plays a sound on new notifications, and lists/marks/deletes them.
export default function NotificationCenter() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const esRef = useRef(null);

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.36);
      o.onended = () => ctx.close();
    } catch (e) { /* audio not allowed yet */ }
  }

  async function load() {
    try { const d = await api('/notifications'); setItems(d.notifications || []); setUnread(d.unread || 0); }
    catch (e) { /* ignore */ }
  }

  useEffect(() => {
    load();
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data && data.notification) {
          setItems((prev) => [data.notification, ...prev]);
          setUnread((u) => u + 1);
          beep();
        }
      } catch (e) { /* heartbeat / non-json */ }
    };
    es.onerror = () => { /* browser auto-reconnects */ };
    return () => es.close();
  }, []);

  async function openItem(n) {
    if (!n.read) {
      try { await api(`/notifications/${n.id}/read`, { method: 'POST' }); } catch (e) {}
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }
  async function markAll() {
    try { await api('/notifications/read-all', { method: 'POST' }); } catch (e) {}
    setItems((prev) => prev.map((x) => ({ ...x, read: true }))); setUnread(0);
  }
  async function del(id, e) {
    e.stopPropagation();
    try { await api(`/notifications/${id}`, { method: 'DELETE' }); } catch (e2) {}
    setItems((prev) => { const it = prev.find((x) => x.id === id); if (it && !it.read) setUnread((u) => Math.max(0, u - 1)); return prev.filter((x) => x.id !== id); });
  }

  return (
    <div className="ncenter">
      <style>{NC_CSS}</style>
      <button className="nc-bell" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {unread > 0 && <span className="nc-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="nc-panel">
          <div className="nc-head">
            <b>الإشعارات</b>
            <button className="nc-link" onClick={markAll} disabled={!unread}>تحديد الكل كمقروء</button>
          </div>
          <div className="nc-list">
            {items.length === 0 && <p className="nc-empty">لا توجد إشعارات.</p>}
            {items.map((n) => (
              <div key={n.id} className={`nc-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <div className="nc-title">{n.title || n.type}</div>
                {n.body && <div className="nc-body">{n.body}</div>}
                <div className="nc-time">{new Date(n.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</div>
                <button className="nc-del" onClick={(e) => del(n.id, e)} aria-label="حذف">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const NC_CSS = `
.ncenter{position:relative;}
.nc-bell{position:relative;background:transparent;border:none;color:#cfd3dc;cursor:pointer;padding:6px;border-radius:8px;}
.nc-bell:hover{background:rgba(255,255,255,.08);}
.nc-badge{position:absolute;top:0;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#e5484d;color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;}
.nc-panel{position:absolute;top:42px;left:0;width:330px;max-height:60vh;overflow:hidden;background:#161922;border:1px solid #272b36;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:50;display:flex;flex-direction:column;}
.nc-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #272b36;}
.nc-link{background:none;border:none;color:#5b8cff;font-size:12px;cursor:pointer;}
.nc-link:disabled{color:#5b6271;cursor:default;}
.nc-list{overflow-y:auto;}
.nc-empty{color:#8c93a3;text-align:center;padding:20px;font-size:13px;}
.nc-item{position:relative;padding:12px 30px 12px 14px;border-bottom:1px solid #20242e;cursor:pointer;}
.nc-item:hover{background:#1c2029;}
.nc-item.unread{background:#19233a;}
.nc-item.unread .nc-title::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#5b8cff;margin-left:6px;}
.nc-title{font-size:13px;font-weight:600;color:#eef0f4;}
.nc-body{font-size:12px;color:#aab0bd;margin-top:3px;}
.nc-time{font-size:11px;color:#6b7280;margin-top:4px;}
.nc-del{position:absolute;top:8px;left:8px;background:none;border:none;color:#6b7280;font-size:16px;cursor:pointer;line-height:1;}
.nc-del:hover{color:#e5484d;}
`;
