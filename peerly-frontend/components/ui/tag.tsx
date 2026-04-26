interface TagProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Tag({ children, active, onClick }: TagProps) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-block', padding: '3px 9px', borderRadius: 999,
        fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
        background: active ? 'var(--accent)' : 'var(--card)',
        color: active ? '#fff' : 'var(--muted)',
        border: active ? 'none' : '1px solid var(--border)',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </span>
  );
}
