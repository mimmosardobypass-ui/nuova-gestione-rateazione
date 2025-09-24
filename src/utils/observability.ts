/**
 * Observability utilities for data contract monitoring
 */

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

// In production, these would go to Sentry/DataDog/etc
const logValidationError = (error: ValidationError) => {
  console.error('[DataContract] Validation failed:', error);
  
  // In production:
  // Sentry.captureException(new Error(error.error), {
  //   tags: { view: 'v_rateations_list_ui' },
  //   user: { id: error.userId },
  //   extra: error.context
  // });
};

const logQueryMetrics = (metrics: QueryMetrics) => {
  console.log('[DataContract] Query metrics:', metrics);
  
  // In production:
  // analytics.track('database_query', metrics);
};

const logHealthViolation = (suspiciousCount: number, totalCount: number, userId: string) => {
  console.warn('[DataContract] Health violation:', {
    suspicious: suspiciousCount,
    total: totalCount,
    percentage: Math.round((suspiciousCount / totalCount) * 100),
    userId
  });
  
  // In production:
  // Sentry.captureMessage('Data integrity violation detected', {
  //   level: 'warning',
  //   tags: { view: 'v_rateations_list_ui', type: 'health_check' },
  //   extra: { suspiciousCount, totalCount, userId }
  // });
};

export { logValidationError, logQueryMetrics, logHealthViolation };