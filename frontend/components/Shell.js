'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearSession } from '@/lib/api';

// Which roles may access each route. Enforced here so direct URL entry is
// blocked too (not just hidden from the sidebar) — Role-Based Access Control.
const ROUTE_ROLES = {
  '/chat': ['agent', 'team_leader', 'admin'],
  '/gaps': ['team_leader', 'admin'],
  '/info-requests': ['team_leader', 'admin'],
  '/dashboard': ['admin'],
  '/admin': ['admin'],
};

// App shell with role-aware navigation + RBAC route guard.
export default function Shell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/login'); return; }
    // RBAC: if this user's role isn't allowed for the current route, bounce
    // them to Chat (the one page everyone can see) — even on direct URL entry.
    const roles = ROUTE_ROLES[pathname];
    if (roles && !roles.includes(u.role)) { router.replace('/chat'); return; }
    setUser(u);
    setAllowed(true);
  }, [router, pathname]);

  if (!user || !allowed) return null;

  const isLeader = user.role === 'team_leader' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  const nav = [
    { href: '/chat', label: '💬 Chat', show: true },
    { href: '/gaps', label: '📋 Gap Requests', show: isLeader },
    { href: '/info-requests', label: '📨 Info Requests', show: isLeader },
    { href: '/dashboard', label: '📊 Dashboard', show: isAdmin },
    { href: '/admin', label: '⚙️ Admin', show: isAdmin },
  ].filter((n) => n.show);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Call Center AI</h1>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? 'active' : ''}>
            {n.label}
          </Link>
        ))}
        <div className="spacer" />
        <div className="userbox">
          <div>{user.name}</div>
          <div>{user.role}</div>
          <button className="ghost" style={{ marginTop: 8, width: '100%' }} onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
