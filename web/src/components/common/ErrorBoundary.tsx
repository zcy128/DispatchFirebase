import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-slate-900 border border-rose-500/30 rounded-2xl text-slate-100 shadow-xl max-w-xl mx-auto space-y-3">
          <div className="flex items-center space-x-3 text-rose-400">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <h3 className="font-bold text-base">
              {this.props.fallbackTitle || 'A component rendering error occurred'}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {this.state.error?.message || 'An unexpected error occurred while displaying this section.'}
          </p>
          <div className="pt-2 flex items-center space-x-2">
            <button
              onClick={this.handleReset}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold rounded-xl border border-rose-500/30 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
