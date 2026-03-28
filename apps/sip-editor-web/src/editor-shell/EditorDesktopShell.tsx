import type { ReactNode } from 'react';
import './editorShell.css';

export interface EditorDesktopShellProps {
  menuBar: ReactNode;
  toolbar: ReactNode;
  leftSidebar: ReactNode;
  workspace: ReactNode;
  rightPanel: ReactNode;
  statusBar: ReactNode;
}

/**
 * Корневой layout редактора: меню → toolbar → три колонки → status bar.
 */
export function EditorDesktopShell({
  menuBar,
  toolbar,
  leftSidebar,
  workspace,
  rightPanel,
  statusBar,
}: EditorDesktopShellProps) {
  return (
    <div className="twix-ui cad-desktop-shell" style={{ flex: 1, minHeight: 0, height: '100%' }}>
      <header style={{ flex: 'none', borderBottom: '1px solid var(--cad-border, #b8c0cc)' }}>
        {menuBar}
      </header>
      <div style={{ flex: 'none', borderBottom: '1px solid var(--cad-border, #b8c0cc)' }}>{toolbar}</div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <aside
          className="cad-left-panel"
          style={{
            flex: 'none',
            width: 220,
            minWidth: 200,
            background: 'var(--cad-panel, #f0f2f5)',
            borderRight: '1px solid var(--cad-border, #b8c0cc)',
            overflow: 'auto',
            padding: '6px 6px 10px',
          }}
        >
          {leftSidebar}
        </aside>
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--cad-app-bg, #e4e6ea)',
          }}
        >
          {workspace}
        </main>
        <aside
          style={{
            flex: 'none',
            width: 300,
            minWidth: 260,
            maxWidth: 380,
            background: 'var(--cad-panel, #f0f2f5)',
            borderLeft: '1px solid var(--cad-border, #b8c0cc)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {rightPanel}
        </aside>
      </div>
      <footer style={{ flex: 'none' }}>{statusBar}</footer>
    </div>
  );
}
