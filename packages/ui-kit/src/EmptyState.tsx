import type { ReactNode } from 'react';
import './shell.css';

export interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Нет данных',
  description,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`twix-empty ${className}`.trim()}>
      <div style={{ fontWeight: 600, color: 'var(--twix-text)', marginBottom: 8 }}>
        {title}
      </div>
      {description ? <div className="twix-muted">{description}</div> : null}
    </div>
  );
}
