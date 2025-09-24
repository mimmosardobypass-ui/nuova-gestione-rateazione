/**
 * Observability utilities for data contract monitoring
 */

// Extend window interface for production observability tools
declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, options?: any) => void;
      captureMessage: (message: string, options?: any) => void;
    };
    analytics?: {
      track: (event: string, properties?: any) => void;
    };
  }
}

interface ValidationError {
  userId: string;
  error: string;
  timestamp: number;
  context: Record<string, unknown>;
}

interface QueryMetrics {
  view: string;
  duration: number;
  rowCount: number;
  timestamp: number;
  userId: string;
}

// Production-ready observability with Sentry integration
const logValidationError = (error: ValidationError) => {
  console.error('[DataContract] Validation failed:', error);
  
  // Production Sentry integration
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(new Error(error.error), {
      tags: { 
        view: 'v_rateations_list_ui',
        component: 'data_validation',
        severity: 'high'
      },
      user: { id: error.userId },
      extra: error.context
    });
  }
};

const logQueryMetrics = (metrics: QueryMetrics) => {
  console.log('[DataContract] Query metrics:', metrics);
  
  // Production analytics
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('database_query', metrics);
  }
};

const logHealthViolation = (suspiciousCount: number, totalCount: number, userId: string) => {
  console.warn('[DataContract] Health violation:', {
    suspicious: suspiciousCount,
    total: totalCount,
    percentage: Math.round((suspiciousCount / totalCount) * 100),
    userId
  });
  
  // Production Sentry alert for data integrity issues
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureMessage('Data integrity violation detected', {
      level: 'warning',
      tags: { 
        view: 'v_rateations_list_ui', 
        type: 'health_check',
        severity: suspiciousCount > totalCount * 0.1 ? 'critical' : 'warning'
      },
      extra: { suspiciousCount, totalCount, userId }
    });
  }
};

export { logValidationError, logQueryMetrics, logHealthViolation };