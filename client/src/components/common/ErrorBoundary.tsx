import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <pre className="mt-3 text-xs bg-slate-100 p-3 rounded-lg text-slate-700 overflow-x-auto text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6">
              <Button
                variant="primary"
                onClick={this.handleReset}
                icon={<RefreshCw className="h-4 w-4" />}
                className="w-full"
              >
                Reload application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
