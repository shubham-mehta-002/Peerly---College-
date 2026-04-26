import { AppNav } from './app-nav';

interface ContentShellProps {
  children: React.ReactNode;
  maxWidth?: number;
  withNav?: boolean;
}

export function ContentShell({ children, maxWidth = 660, withNav = true }: ContentShellProps) {
  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {withNav && <AppNav />}
      <div style={{ maxWidth, margin: '0 auto', width: '100%', padding: '32px 24px', boxSizing: 'border-box', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
