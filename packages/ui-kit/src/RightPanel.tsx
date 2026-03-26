import type { ReactNode } from 'react';
import './shell.css';

export interface RightPanelProps {
  children: ReactNode;
  className?: string;
}

export function RightPanel({ children, className = '' }: RightPanelProps) {
  return <div className={className}>{children}</div>;
}
