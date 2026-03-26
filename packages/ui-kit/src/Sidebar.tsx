import type { ReactNode } from 'react';
import './shell.css';

export interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className = '' }: SidebarProps) {
  return <nav className={className}>{children}</nav>;
}
