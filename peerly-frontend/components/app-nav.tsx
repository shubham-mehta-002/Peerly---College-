'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTweaks } from '@/lib/context';
import { useMe } from '@/lib/hooks/useAuth';

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { darkMode, setDarkMode } = useTweaks();
  const { data: me } = useMe();

  const links = [
    { href: '/feed', label: 'Feed' },
    { href: '/communities', label: 'Communities' },
    { href: '/profile/me', label: 'Profile' },
    ...(me?.is_admin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/feed') return pathname === '/feed' || (pathname.startsWith('/posts') && pathname !== '/posts/new');
    if (href.startsWith('/profile')) return pathname.startsWith('/profile');
    if (href === '/admin') return pathname.startsWith('/admin');
    return pathname.startsWith(href);
  };

  return (
    <nav style={{
      height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 24px', borderBottom: '1px solid var(--border)', background: 'var(--background)',
      position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
    }}>
      <Link href="/feed" style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.3px', textDecoration: 'none' }}>
        Peerly
      </Link>

      <div style={{ display: 'flex', gap: 24 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{
            fontFamily: 'inherit', fontSize: 14, fontWeight: isActive(l.href) ? 600 : 400,
            color: isActive(l.href) ? 'var(--foreground)' : 'var(--muted)',
            textDecoration: 'none',
          }}>
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: 0, lineHeight: 1 }}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? '☀' : '◑'}
        </button>
        <Link href="/posts/new" style={{
          background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '0 18px', height: 30, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
          textDecoration: 'none', display: 'flex', alignItems: 'center',
        }}>
          + Post
        </Link>
      </div>
    </nav>
  );
}
