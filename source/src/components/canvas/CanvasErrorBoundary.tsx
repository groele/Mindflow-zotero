import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { MindMapNode } from '../../core/model/types';
import { exportToJSON } from '../../services/io/exporter';

interface Props {
  children: ReactNode;
  rootNode?: MindMapNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CanvasErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleEmergencyExport = () => {
    if (this.props.rootNode) {
      exportToJSON(this.props.rootNode, `mindflow-emergency-backup-${Date.now()}`);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-red-200 dark:border-red-900/50 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              画布渲染发生异常
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              思维导图节点或视图计算遇到未预期的问题。别担心，您的底层数据完整安全。
            </p>

            {this.state.error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-xs text-red-600 dark:text-red-400 text-left font-mono overflow-auto max-h-24 mb-6">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                重新加载画布
              </button>
              {this.props.rootNode && (
                <button
                  onClick={this.handleEmergencyExport}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  title="安全导出当前脑图的JSON数据"
                >
                  <Download className="w-4 h-4" />
                  应急备份
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
