import type { ReactNode } from 'react';
import { cad } from './cadTheme';

export interface EditorRightInspectorPanelProps {
  title?: string;
  children: ReactNode;
}

/** Обёртка правой панели в стиле docking inspector / CAD. */
export function EditorRightInspectorPanel({ title = 'Инспектор', children }: EditorRightInspectorPanelProps) {
  return (
    <div
      className="cad-inspector-scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: cad.panelBg,
      }}
    >
      <div
        style={{
          flex: 'none',
          padding: '6px 10px',
          borderBottom: `1px solid ${cad.panelBorder}`,
          fontSize: cad.fontSize,
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: cad.text,
          background: cad.toolbarBg,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '8px 10px', overflow: 'auto' }}>{children}</div>
    </div>
  );
}
