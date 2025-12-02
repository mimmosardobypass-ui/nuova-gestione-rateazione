import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logValidationError } from '@/utils/observability';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🔴 [ErrorBoundary] Caught error:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 [ErrorBoundary] Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    
    this.setState({ errorInfo });
    
    // Log validation/rendering errors to observability
    logValidationError({
      userId: 'unknown',
      error: error.message,
      timestamp: Date.now(),
      context: { 
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });
  }

  handleReset = () => {
    console.log('🔄 [ErrorBoundary] Resetting error state...');
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <Alert 
          className="m-4 border-destructive/50 bg-destructive/10 text-destructive"
          data-testid="error-boundary"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <strong>Errore nell'applicazione:</strong> Si è verificato un errore imprevisto.
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={this.handleReset}
                className="gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Riprova
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                Ricarica Pagina
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
