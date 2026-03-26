import type { ReactNode } from 'react';
import './shell.css';

export interface TopBarProps {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function TopBar({ title, trailing, className = '' }: TopBarProps) {
  return (
    <header className={`twix-topBar ${className}`.trim()}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
      {trailing ? (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
