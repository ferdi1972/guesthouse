import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred. Please try again.";
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('insufficient permissions')) {
            isPermissionError = true;
            errorMessage = "You don't have permission to perform this action. Please contact an administrator.";
          }
        }
      } catch (e) {
        // Not a JSON error, use default or message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-stone-100 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <AlertTriangle className="w-10 h-10 text-rose-600" />
            </div>
            
            <h1 className="text-3xl font-serif italic text-stone-900 mb-4">
              {isPermissionError ? 'Access Denied' : 'Something went wrong'}
            </h1>
            
            <p className="text-stone-500 mb-10 leading-relaxed">
              {errorMessage}
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 bg-white text-stone-600 border border-stone-200 px-6 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-stone-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">
                Error Reference: {this.state.error?.name || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
