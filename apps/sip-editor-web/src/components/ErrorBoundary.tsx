import React from 'react';
import { Link } from 'react-router-dom';
import { crmSipProjectsUrl } from '../routes/crmEntry';

interface State {
  hasError: boolean;
  message: string;
}

interface Props {
  scope: 'shell' | 'preview3d';
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown): void {
    if (import.meta.env.DEV) {
      console.error(`[sip-editor][${this.props.scope}]`, error);
    }
  }

  private reset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const toProjects = crmSipProjectsUrl();
    if (this.props.scope === 'preview3d') {
      return (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>3D preview временно недоступен</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7f1d1d' }}>{this.state.message}</p>
          <button type="button" onClick={this.reset} style={{ marginTop: 8, fontSize: 12, padding: '4px 10px' }}>
            Повторить
          </button>
        </div>
      );
    }
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ margin: 0 }}>Ошибка редактора</h2>
        <p style={{ marginTop: 8, color: '#475569' }}>
          Произошла runtime-ошибка. Можно перезагрузить страницу или вернуться в CRM.
        </p>
        <p style={{ marginTop: 6, fontSize: 13, color: '#991b1b' }}>Диагностика: {this.state.message}</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.location.reload()} style={{ fontSize: 13, padding: '6px 12px' }}>
            Перезагрузить
          </button>
          <a href={toProjects} style={{ fontSize: 13, padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}>
            Назад к SIP Проектам
          </a>
          <Link to="/sip-editor/dev-launch" style={{ fontSize: 13, padding: '6px 12px' }}>
            Dev-launch
          </Link>
        </div>
      </div>
    );
  }
}

