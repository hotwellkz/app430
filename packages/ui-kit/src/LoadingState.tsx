import './shell.css';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Загрузка…',
  className = '',
}: LoadingStateProps) {
  return <div className={`twix-loading ${className}`.trim()}>{message}</div>;
}
