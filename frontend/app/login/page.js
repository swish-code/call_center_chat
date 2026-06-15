'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [light, setLight] = useState(true);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setSession(token, user);
      router.replace('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`ssc-root ${light ? 'ssc-light' : 'ssc-dark'}`}>
      <style>{CSS}</style>

      {/* Left — brand panel */}
      <section className="ssc-left">
        <div className="ssc-brandrow">
          <span className="ssc-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b0d12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </span>
          <div>
            <div className="ssc-brandname"><b>SWISH</b> SUPPORT</div>
            <div className="ssc-brandsub">CHAT INFRASTRUCTURE</div>
          </div>
        </div>

        <h1 className="ssc-hero">SWISH<br />SUPPORT<br /><span>CHAT.</span></h1>
        <p className="ssc-tag">The next evolution in customer support. Intelligent, grounded answers for top-tier operations.</p>

        <ul className="ssc-features">
          <li>
            <span className="ssc-ficon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
            HIGH-PRECISION KNOWLEDGE BASE
          </li>
          <li>
            <span className="ssc-ficon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>
            REAL-TIME RESPONSE ANALYTICS
          </li>
          <li>
            <span className="ssc-ficon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span>
            HUMAN-APPROVED ANSWERS ONLY
          </li>
        </ul>
      </section>

      {/* Right — login panel */}
      <section className="ssc-right">
        <button type="button" className="ssc-toggle" onClick={() => setLight((v) => !v)} aria-label="Toggle theme">
          {light
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>}
        </button>

        <form className="ssc-form" onSubmit={submit}>
          <span className="ssc-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b53f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0-2 1.5-3 3-3M9 11V8a3 3 0 0 1 6 0M7 11c0-1 .5-2 1-2.5M12 14v4M9 21h6"/><circle cx="12" cy="12" r="9" opacity=".25"/></svg>
            SECURE LOGIN
          </span>

          <h2 className="ssc-title">OPERATOR<br /><span>VERIFICATION</span></h2>
          <p className="ssc-subtitle">ESTABLISH A SECURE CONNECTION TO SWISH SUPPORT CHAT</p>

          <label className="ssc-label">▸ EMAIL</label>
          <input className="ssc-input" type="email" value={email} placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />

          <label className="ssc-label">▸ PASSWORD</label>
          <input className="ssc-input" type="password" value={password} placeholder="••••••••••"
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />

          {error && <p className="ssc-error">{error}</p>}

          <button className="ssc-submit" type="submit" disabled={loading}>
            {loading ? 'CONNECTING…' : 'LOG IN ›'}
          </button>
        </form>
      </section>
    </div>
  );
}

const CSS = `
.ssc-root{position:fixed;inset:0;display:flex;font-family:'Segoe UI',system-ui,Arial,sans-serif;}
.ssc-left{flex:1;background:radial-gradient(120% 120% at 0% 0%, #1a1d27 0%, #0a0b10 55%);color:#fff;padding:56px 64px;display:flex;flex-direction:column;}
.ssc-brandrow{display:flex;align-items:center;gap:14px;}
.ssc-logo{width:46px;height:46px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;}
.ssc-brandname{font-size:20px;letter-spacing:1px;font-weight:800;}
.ssc-brandname b{color:#fff;} .ssc-brandname{color:#8c93a3;}
.ssc-brandsub{font-size:11px;letter-spacing:4px;color:#5b6271;margin-top:2px;}
.ssc-hero{font-size:64px;line-height:.98;font-weight:900;margin:auto 0 0;letter-spacing:-1px;}
.ssc-hero span{color:#5b53f0;}
.ssc-tag{color:#8c93a3;font-size:17px;max-width:430px;margin:22px 0 0;line-height:1.55;}
.ssc-features{list-style:none;padding:0;margin:auto 0 0;display:flex;flex-direction:column;gap:26px;}
.ssc-features li{display:flex;align-items:center;gap:16px;font-size:13px;letter-spacing:2px;font-weight:700;font-style:italic;color:#c8ccd6;}
.ssc-ficon{width:42px;height:42px;border-radius:12px;background:#15171f;border:1px solid #23262f;display:flex;align-items:center;justify-content:center;color:#9aa0ad;}

.ssc-right{flex:1;display:flex;align-items:center;justify-content:center;position:relative;padding:40px;}
.ssc-light .ssc-right{background:#ffffff;color:#0b0d12;}
.ssc-dark .ssc-right{background:#0e1017;color:#fff;}
.ssc-toggle{position:absolute;top:28px;right:28px;width:42px;height:42px;border-radius:12px;border:1px solid #e3e5ee;background:#f4f5fb;color:#0b0d12;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.ssc-dark .ssc-toggle{background:#1a1d27;border-color:#272b36;color:#fff;}
.ssc-form{width:100%;max-width:430px;}
.ssc-pill{display:inline-flex;align-items:center;gap:9px;padding:9px 16px;border-radius:30px;background:#f1f2fb;border:1px solid #e6e7f4;font-size:11px;letter-spacing:3px;font-weight:800;color:#3a3f52;}
.ssc-dark .ssc-pill{background:#171a23;border-color:#272b36;color:#c8ccd6;}
.ssc-title{font-size:46px;line-height:1;font-weight:900;font-style:italic;margin:26px 0 0;letter-spacing:-1px;}
.ssc-title span{color:#5b53f0;}
.ssc-subtitle{letter-spacing:2px;font-size:12px;font-weight:700;color:#9aa0ad;margin:14px 0 34px;}
.ssc-label{display:block;font-size:12px;letter-spacing:2px;font-weight:800;color:#7c8290;margin:0 0 8px;}
.ssc-input{width:100%;box-sizing:border-box;padding:16px 18px;border-radius:14px;border:1px solid transparent;background:#eef0fb;color:#0b0d12;font-size:15px;margin-bottom:22px;outline:none;transition:border-color .15s;}
.ssc-input:focus{border-color:#5b53f0;}
.ssc-dark .ssc-input{background:#171a23;color:#fff;}
.ssc-error{color:#e5484d;font-size:13px;margin:-8px 0 16px;}
.ssc-submit{width:100%;padding:20px;border:none;border-radius:18px;background:#0b0d12;color:#fff;font-size:14px;letter-spacing:4px;font-weight:800;cursor:pointer;transition:transform .08s,opacity .15s;}
.ssc-submit:hover{opacity:.9;} .ssc-submit:active{transform:scale(.99);} .ssc-submit:disabled{opacity:.6;cursor:default;}
.ssc-dark .ssc-submit{background:#5b53f0;}
@media (max-width:900px){
  .ssc-left{display:none;}
  .ssc-right{flex:1;}
}
`;
