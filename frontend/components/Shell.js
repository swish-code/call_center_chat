'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearSession } from '@/lib/api';

// App shell with role-aware navigation. Redirects to /login if no session.
export default function Shell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) router.replace('/login');
    else setUser(u);
  }, [router]);

  if (!user) return null;

  const isLeader = user.role === 'team_leader' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  const nav = [
    { href: '/chat', label: '💬 Chat', show: true },
    { href: '/gaps', label: '📋 Gap Requests', show: isLeader },
    { href: '/info-requests', label: '📨 Info Requests', show: isLeader },
    { href: '/dashboard', label: '📊 Dashboard', show: isLeader },
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
