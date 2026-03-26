import './shell.css';

export interface CanvasPlaceholderProps {
  text: string;
  className?: string;
}

export function CanvasPlaceholder({ text, className = '' }: CanvasPlaceholderProps) {
  return (
    <div className={`twix-canvasPlaceholder ${className}`.trim()}>{text}</div>
  );
}
