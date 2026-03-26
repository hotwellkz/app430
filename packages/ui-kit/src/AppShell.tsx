import type { ReactNode } from 'react';
import './shell.css';

export interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel: ReactNode;
  className?: string;
}

export function AppShell({
  topBar,
  sidebar,
  main,
  rightPanel,
  className = '',
}: AppShellProps) {
  return (
    <div className={`twix-ui twix-appShell ${className}`.trim()}>
      {topBar}
      <div className="twix-body">
        <aside className="twix-sidebar">{sidebar}</aside>
        <div className="twix-main">{main}</div>
        <aside className="twix-rightPanel">{rightPanel}</aside>
      </div>
    </div>
  );
}
