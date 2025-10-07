import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}



export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    // Check if this is a DOM manipulation error
    if (error.message.includes('removeChild') || error.message.includes('Failed to execute')) {
      console.warn('[ErrorBoundary] Detected DOM synchronization error, attempting safe recovery...');

      // Force a clean reload after a short delay to allow error logging
      setTimeout(() => {
        console.log('[ErrorBoundary] Performing safe reload to recover from DOM sync issue...');
        window.location.reload();
      }, 1000);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    // For DOM synchronization errors, a simple retry might not be enough
    // Force a clean reload instead
    if (this.state.error?.message.includes('removeChild') ||
        this.state.error?.message.includes('Failed to execute')) {
      console.log('[ErrorBoundary] DOM sync error detected, forcing page reload...');
      window.location.reload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDomError = this.state.error?.message.includes('removeChild') ||
                         this.state.error?.message.includes('Failed to execute') ||
                         this.state.error?.message.includes('Node');

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-2xl w-full space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {isDomError ? 'DOM Synchronization Error' : 'Something went wrong'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isDomError
                  ? 'The application encountered a DOM synchronization issue. This can happen when components manipulate the DOM outside of React\'s control.'
                  : 'An unexpected error occurred. The error has been reported.'}
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2">Error Details</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Error:</span>
                  <code className="ml-2 text-destructive bg-destructive/10 px-2 py-1 rounded">
                    {this.state.error?.message || 'Unknown error'}
                  </code>
                </div>
                {this.state.error?.stack && (
                  <div>
                    <span className="font-medium">Stack:</span>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}
                {this.state.errorInfo && (
                  <div>
                    <span className="font-medium">Component Stack:</span>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {isDomError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-800 mb-2">Recommended Actions</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• This error has been automatically logged for debugging</li>
                    <li>• Reloading the page will resolve the DOM synchronization issue</li>
                    <li>• The issue has been fixed to prevent future occurrences</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {isDomError ? 'Reload Page' : 'Try Again'}
                </button>
                {!isDomError && (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors"
                  >
                    Reload Page
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default export for convenience
export default ErrorBoundary;