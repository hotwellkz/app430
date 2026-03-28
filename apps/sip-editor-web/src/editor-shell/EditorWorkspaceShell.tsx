import type { ReactNode } from 'react';
import { cad } from './cadTheme';

export interface EditorWorkspaceShellProps {
  children: ReactNode;
  /** Подпись в углу холста (слой и т.п.) */
  layerHint?: string;
}

export function EditorWorkspaceShell({ children, layerHint = 'Активный слой не выбран' }: EditorWorkspaceShellProps) {
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        margin: 6,
        border: `1px solid ${cad.panelBorder}`,
        borderRadius: cad.btnRadius,
        background: '#e8e8ea',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 8,
          zIndex: 2,
          pointerEvents: 'none',
          fontSize: cad.fontSizeSm,
          color: cad.muted,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {layerHint}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}
