/**
 * Migration System Monitoring and Debug Utilities
 * 
 * This module provides comprehensive monitoring for the debt migration system,
 * including sanity checks, debug logging, and inconsistency detection.
 */

import { RateationRow } from '../types';

/**
 * Sanity check for KPI consistency
 * Only performs checks on rows that are NOT excluded from stats
 */
export function performKpiSanityChecks(rows: RateationRow[]): void {
  if (process.env.NODE_ENV !== 'development') return;

  rows.forEach(row => {
    // Skip excluded rows to avoid false positives
    if (row.excluded_from_stats) return;

    // Check basic KPI consistency
    const calculatedUnpaid = (row.rateTotali || 0) - (row.ratePagate || 0);
    if (Math.abs(calculatedUnpaid - (row.rateNonPagate || 0)) > 0.01) {
      console.warn('[KPI-MISMATCH]', {
        id: row.id,
        numero: row.numero,
        calculated: calculatedUnpaid,
        stored: row.rateNonPagate,
        message: 'Inconsistenza tra rate calcolate e memorizzate'
      });
    }

    // Check debt migration consistency
    if (row.debts_total && row.debts_migrated) {
      if (row.debts_migrated > row.debts_total) {
        console.warn('[DEBTS-MISMATCH]', {
          id: row.id,
          numero: row.numero,
          migrated: row.debts_migrated,
          total: row.debts_total,
          message: 'Cartelle migrate > cartelle totali'
        });
      }

      // Check migration status consistency
      if (row.rq_migration_status === 'full' && row.debts_migrated !== row.debts_total) {
        console.warn('[MIGRATION-STATUS-MISMATCH]', {
          id: row.id,
          numero: row.numero,
          status: row.rq_migration_status,
          migrated: row.debts_migrated,
          total: row.debts_total,
          message: 'Status "full" ma migrazione incompleta'
        });
      }
    }

    // PagoPA banner consistency check
    if (row.is_pagopa && !row.excluded_from_stats) {
      const shouldShowBanner = (row.unpaid_overdue_today || 0) >= (row.max_skips_effective || 8);
      if (shouldShowBanner !== (row.at_risk_decadence || false)) {
        console.warn('[KPI-BANNER-MISMATCH]', {
          id: row.id,
          numero: row.numero,
          overdue: row.unpaid_overdue_today,
          maxSkips: row.max_skips_effective,
          shouldShow: shouldShowBanner,
          actualFlag: row.at_risk_decadence,
          message: 'Banner decadenza non coerente con KPI'
        });
      }
    }
  });
}

/**
 * Enhanced debug logging for migration operations
 */
export function logMigrationOperation(
  operation: 'start' | 'success' | 'error' | 'rollback',
  data: {
    sourceId: string;
    targetId?: string;
    debtIds?: string[];
    error?: Error;
    note?: string;
  }
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    ...data
  };

  switch (operation) {
    case 'start':
      console.log('[MIGRATION-START]', logEntry);
      break;
    case 'success':
      console.log('[MIGRATION-SUCCESS]', logEntry);
      break;
    case 'error':
      console.error('[MIGRATION-ERROR]', logEntry);
      break;
    case 'rollback':
      console.log('[MIGRATION-ROLLBACK]', logEntry);
      break;
  }

  // Store in session storage for debugging
  try {
    const migrationLogs = JSON.parse(sessionStorage.getItem('migration_logs') || '[]');
    migrationLogs.push(logEntry);
    // Keep only last 50 entries
    if (migrationLogs.length > 50) {
      migrationLogs.splice(0, migrationLogs.length - 50);
    }
    sessionStorage.setItem('migration_logs', JSON.stringify(migrationLogs));
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Generate migration system health report
 */
export function generateMigrationHealthReport(rows: RateationRow[]): {
  totalRateations: number;
  pagopaRateations: number;
  migratedRateations: number;
  partialMigrations: number;
  fullMigrations: number;
  excludedFromStats: number;
  issues: Array<{ type: string; count: number; description: string }>;
} {
  const report = {
    totalRateations: rows.length,
    pagopaRateations: rows.filter(r => r.is_pagopa).length,
    migratedRateations: rows.filter(r => r.rq_migration_status !== 'none').length,
    partialMigrations: rows.filter(r => r.rq_migration_status === 'partial').length,
    fullMigrations: rows.filter(r => r.rq_migration_status === 'full').length,
    excludedFromStats: rows.filter(r => r.excluded_from_stats).length,
    issues: [] as Array<{ type: string; count: number; description: string }>
  };

  // Detect potential issues
  const kpiMismatches = rows.filter(r => {
    if (r.excluded_from_stats) return false;
    const calculatedUnpaid = (r.rateTotali || 0) - (r.ratePagate || 0);
    return Math.abs(calculatedUnpaid - (r.rateNonPagate || 0)) > 0.01;
  });

  const debtMismatches = rows.filter(r => 
    r.debts_total && r.debts_migrated && r.debts_migrated > r.debts_total
  );

  const statusMismatches = rows.filter(r => 
    r.rq_migration_status === 'full' && 
    r.debts_migrated !== r.debts_total
  );

  if (kpiMismatches.length > 0) {
    report.issues.push({
      type: 'KPI_MISMATCH',
      count: kpiMismatches.length,
      description: 'Inconsistenze nei KPI calcolati vs memorizzati'
    });
  }

  if (debtMismatches.length > 0) {
    report.issues.push({
      type: 'DEBT_COUNT_MISMATCH',
      count: debtMismatches.length,
      description: 'Cartelle migrate > cartelle totali'
    });
  }

  if (statusMismatches.length > 0) {
    report.issues.push({
      type: 'MIGRATION_STATUS_MISMATCH',
      count: statusMismatches.length,
      description: 'Status "full" ma migrazione incompleta'
    });
  }

  console.log('[MIGRATION-HEALTH-REPORT]', report);
  return report;
}

/**
 * Clear migration debug logs
 */
export function clearMigrationLogs(): void {
  try {
    sessionStorage.removeItem('migration_logs');
    console.log('[MIGRATION-LOGS] Cleared debug logs');
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Export migration logs for debugging
 */
export function exportMigrationLogs(): string {
  try {
    const logs = sessionStorage.getItem('migration_logs') || '[]';
    const parsed = JSON.parse(logs);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return '[]';
  }
}
