'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getUser } from '@/lib/api';

export default function AdminPage() {
  const [tab, setTab] = useState('brands');
  return (
    <Shell>
      <h2>Admin</h2>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {['brands', 'users', 'knowledge', 'structured'].map((t) => (
          <button key={t} className={tab === t ? '' : 'ghost'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'brands' && <Brands />}
      {tab === 'users' && <Users />}
      {tab === 'knowledge' && <Knowledge />}
      {tab === 'structured' && <Structured />}
    </Shell>
  );
}

function useError() {
  const [error, setError] = useState('');
  return [error, setError];
}

function Brands() {
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useError();
  const load = () => api('/brands').then(setBrands).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  async function add(e) {
    e.preventDefault();
    try { await api('/brands', { method: 'POST', body: { name, description } }); setName(''); setDescription(''); load(); }
    catch (err) { setError(err.message); }
  }
  async function del(id) {
    if (!confirm('Delete this brand and all its data?')) return;
    try { await api(`/brands/${id}`, { method: 'DELETE' }); load(); } catch (err) { setError(err.message); }
  }
  return (
    <div className="card">
      <h3>Brands ({brands.length})</h3>
      {error && <p className="error">{error}</p>}
      <form className="row" onSubmit={add} style={{ alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1 }}><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div style={{ flex: 2 }}><label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button type="submit">Add</button>
      </form>
      <table style={{ marginTop: 14 }}>
        <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.id}><td>{b.name}</td><td className="muted">{b.description}</td>
              <td><button className="danger" onClick={() => del(b.id)}>Delete</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [error, setError] = useError();
  const me = getUser();
  const load = () => api('/auth/users').then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  async function add(e) {
    e.preventDefault();
    setError('');
    try { await api('/auth/register', { method: 'POST', body: form }); setForm({ name: '', email: '', password: '', role: 'agent' }); load(); }
    catch (err) { setError(err.message); }
  }
  async function changeRole(id, role) {
    setError('');
    try { await api(`/auth/users/${id}`, { method: 'PATCH', body: { role } }); load(); }
    catch (err) { setError(err.message); }
  }
  async function toggleActive(u) {
    setError('');
    try { await api(`/auth/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); load(); }
    catch (err) { setError(err.message); }
  }
  async function del(u) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    setError('');
    try { await api(`/auth/users/${u.id}`, { method: 'DELETE' }); load(); }
    catch (err) { setError(err.message); }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="card">
      <h3>Users ({users.length})</h3>
      {error && <p className="error">{error}</p>}
      <form onSubmit={add}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><label>Name</label><input value={form.name} onChange={set('name')} /></div>
          <div style={{ flex: 1 }}><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
          <div style={{ flex: 1 }}><label>Password</label><input type="password" value={form.password} onChange={set('password')} /></div>
          <div style={{ width: 140 }}><label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="agent">agent</option>
              <option value="team_leader">team_leader</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="submit">Create</button>
        </div>
      </form>
      <table style={{ marginTop: 14 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{users.map((u) => {
          const self = me && u.id === me.id;
          return (
            <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
              <td>{u.name}{self && <span className="muted"> (you)</span>}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} disabled={self} onChange={(e) => changeRole(u.id, e.target.value)}>
                  <option value="agent">agent</option>
                  <option value="team_leader">team_leader</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>{u.active ? <span style={{ color: '#22c55e' }}>active</span> : <span style={{ color: '#f59e0b' }}>disabled</span>}</td>
              <td className="row" style={{ gap: 6 }}>
                <button className="ghost" disabled={self} onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                <button className="danger" disabled={self} onClick={() => del(u)}>Delete</button>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function BrandSelect({ brands, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select brand…</option>
      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

function Knowledge() {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [chunks, setChunks] = useState([]);
  const [content, setContent] = useState('');
  const [error, setError] = useError();
  useEffect(() => { api('/brands').then(setBrands).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (brandId) api(`/knowledge/${brandId}`).then(setChunks).catch((e) => setError(e.message)); }, [brandId]);
  async function add(e) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await api('/knowledge', { method: 'POST', body: { brandId: brandId || undefined, content } });
      setContent('');
      if (brandId) setChunks(await api(`/knowledge/${brandId}`));
    } catch (err) { setError(err.message); }
  }
  async function del(id) {
    try { await api(`/knowledge/chunk/${id}`, { method: 'DELETE' }); setChunks((c) => c.filter((x) => x.id !== id)); }
    catch (err) { setError(err.message); }
  }
  return (
    <div className="card">
      <h3>Knowledge base</h3>
      <p className="muted">Adding text here embeds it immediately (requires GEMINI_API_KEY).</p>
      {error && <p className="error">{error}</p>}
      <label>Brand</label>
      <BrandSelect brands={brands} value={brandId} onChange={setBrandId} />
      <form onSubmit={add}>
        <label>New chunk</label>
        <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Policy, FAQ, description… (AR or EN)" />
        <button type="submit" style={{ marginTop: 10 }}>Embed & add</button>
      </form>
      <table style={{ marginTop: 14 }}>
        <thead><tr><th>Content</th><th>Lang</th><th>Source</th><th></th></tr></thead>
        <tbody>
          {chunks.map((c) => (
            <tr key={c.id}><td>{c.content.slice(0, 100)}</td><td>{c.language}</td><td className="muted">{c.source}</td>
              <td><button className="danger" onClick={() => del(c.id)}>×</button></td></tr>
          ))}
          {brandId && chunks.length === 0 && <tr><td colSpan={4} className="muted">No chunks for this brand.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Structured() {
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [branches, setBranches] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [branch, setBranch] = useState({ name: '', city: '', address: '', phone: '', workingHours: '' });
  const [price, setPrice] = useState({ itemName: '', price: '', currency: 'EGP', notes: '' });
  const [error, setError] = useError();
  useEffect(() => { api('/brands').then(setBrands).catch((e) => setError(e.message)); }, []);
  async function reload(id) {
    setBranches(await api(`/branches/${id}`));
    setPricing(await api(`/pricing/${id}`));
  }
  useEffect(() => { if (brandId) reload(brandId).catch((e) => setError(e.message)); }, [brandId]);

  async function addBranch(e) {
    e.preventDefault();
    try { await api('/branches', { method: 'POST', body: { brandId, ...branch } }); setBranch({ name: '', city: '', address: '', phone: '', workingHours: '' }); reload(brandId); }
    catch (err) { setError(err.message); }
  }
  async function addPrice(e) {
    e.preventDefault();
    try { await api('/pricing', { method: 'POST', body: { brandId, ...price, price: Number(price.price) } }); setPrice({ itemName: '', price: '', currency: 'EGP', notes: '' }); reload(brandId); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="card">
      <h3>Structured data</h3>
      {error && <p className="error">{error}</p>}
      <label>Brand</label>
      <BrandSelect brands={brands} value={brandId} onChange={setBrandId} />

      {brandId && (
        <>
          <h4>Branches</h4>
          <form className="row" onSubmit={addBranch} style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Name" value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} style={{ flex: 1 }} />
            <input placeholder="City" value={branch.city} onChange={(e) => setBranch({ ...branch, city: e.target.value })} style={{ flex: 1 }} />
            <input placeholder="Phone" value={branch.phone} onChange={(e) => setBranch({ ...branch, phone: e.target.value })} style={{ flex: 1 }} />
            <input placeholder="Working hours" value={branch.workingHours} onChange={(e) => setBranch({ ...branch, workingHours: e.target.value })} style={{ flex: 1 }} />
            <button type="submit">Add</button>
          </form>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Name</th><th>City</th><th>Phone</th><th>Hours</th></tr></thead>
            <tbody>{branches.map((b) => <tr key={b.id}><td>{b.name}</td><td>{b.city}</td><td>{b.phone}</td><td>{b.working_hours}</td></tr>)}</tbody>
          </table>

          <h4 style={{ marginTop: 20 }}>Pricing</h4>
          <form className="row" onSubmit={addPrice} style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Item" value={price.itemName} onChange={(e) => setPrice({ ...price, itemName: e.target.value })} style={{ flex: 1 }} />
            <input placeholder="Price" type="number" step="0.01" value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} style={{ width: 110 }} />
            <input placeholder="Currency" value={price.currency} onChange={(e) => setPrice({ ...price, currency: e.target.value })} style={{ width: 90 }} />
            <input placeholder="Notes" value={price.notes} onChange={(e) => setPrice({ ...price, notes: e.target.value })} style={{ flex: 1 }} />
            <button type="submit">Add</button>
          </form>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Item</th><th>Price</th><th>Currency</th><th>Notes</th></tr></thead>
            <tbody>{pricing.map((p) => <tr key={p.id}><td>{p.item_name}</td><td>{p.price}</td><td>{p.currency}</td><td>{p.notes}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
