import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { logValidationError } from '@/utils/observability';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Alert 
          className="m-4 border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          data-testid="error-boundary"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Errore nell'applicazione:</strong> Si è verificato un errore imprevisto. 
            Ricaricare la pagina o contattare il supporto se il problema persiste.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}