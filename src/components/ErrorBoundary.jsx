import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="text-6xl mb-6">😕</div>
            <h2 className="text-3xl font-extrabold text-gray-900">
              Oops! Something went wrong.
            </h2>
            <p className="mt-2 text-gray-600">
              We're sorry, but an unexpected error occurred. Please try again later.
            </p>
            <div className="mt-8">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 p-4 bg-red-50 rounded-md text-left text-sm text-red-700">
                <p className="font-medium">Error details (only visible in development):</p>
                <pre className="mt-2 overflow-auto max-h-40 p-2 bg-white border border-red-200 rounded">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <div className="mt-2 text-xs">
                      {this.state.error.stack.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
