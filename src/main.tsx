import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './pages/app/App';
import './styles/index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MindFlow Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          color: '#1e293b',
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            padding: '1.75rem'
          }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#dc2626', margin: '0 0 0.75rem 0' }}>
              ⚠️ MindFlow 启动发生异常
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
              工作区在初始化时捕获到运行时错误，请检查以下错误信息：
            </p>
            <pre style={{
              backgroundColor: '#f1f5f9',
              fontSize: '0.75rem',
              padding: '0.75rem',
              borderRadius: '6px',
              color: '#b91c1c',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              margin: '0 0 1.25rem 0',
              border: '1px solid #e2e8f0'
            }}>
              {this.state.error?.stack || this.state.error?.message || '未知错误'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              重新加载工作区
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <RootErrorBoundary>
          <App isSidepanelMode={false} />
        </RootErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    console.error('[MindFlow Mount Fatal Error]', err);
    rootEl.innerHTML = `
      <div style="padding: 30px; font-family: sans-serif; background: #fff; color: #dc2626;">
        <h2>MindFlow 加载失败</h2>
        <pre style="background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">${String(err)}</pre>
      </div>
    `;
  }
}
