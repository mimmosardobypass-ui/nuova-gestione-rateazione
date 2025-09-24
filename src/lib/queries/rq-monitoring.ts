/**
 * Query di monitoring e integrity checking per RQ Allocation System
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica over-allocation (quota allocata > residuo PagoPA)
 */
export interface OverAllocationIssue {
  pagopa_id: number;
  pagopa_number: string;
  taxpayer_name: string;
  residual_cents: number;
  allocated_cents: number;
  excess_cents: number;
  affected_links: number;
}

export async function detectOverAllocations(): Promise<OverAllocationIssue[]> {
  const { data, error } = await supabase
    .from('v_pagopa_allocations')
    .select(`
      pagopa_id,
      pagopa_number,
      taxpayer_name,
      residual_cents,
      allocated_cents,
      allocatable_cents
    `)
    .lt('allocatable_cents', 0); // allocatable_cents < 0 indica over-allocation

  if (error) throw error;

  return (data || []).map(row => ({
    pagopa_id: row.pagopa_id,
    pagopa_number: row.pagopa_number,
    taxpayer_name: row.taxpayer_name,
    residual_cents: row.residual_cents,
    allocated_cents: row.allocated_cents,
    excess_cents: Math.abs(row.allocatable_cents),
    affected_links: 0 // Potrebbe essere calcolato con una query aggiuntiva
  }));
}

/**
 * Verifica link orfani (PagoPA o RQ inesistenti/non accessible)
 */
export interface OrphanedLink {
  link_id: string;
  pagopa_id: number;
  riam_quater_id: number;
  allocated_cents: number;
  issue_type: 'pagopa_missing' | 'rq_missing' | 'access_denied';
}

export async function detectOrphanedLinks(): Promise<OrphanedLink[]> {
  try {
    const { data: links, error } = await supabase
      .from('riam_quater_links')
      .select('id, pagopa_id, riam_quater_id, allocated_residual_cents')
      .limit(1000);
    if (error || !links) return [];

    const pagopaIds = [...new Set(links.map(l => l.pagopa_id))];
    const rqIds = [...new Set(links.map(l => l.riam_quater_id))];

    const [{ data: pagopas }, { data: rqs }] = await Promise.all([
      supabase.from('rateations').select('id, owner_uid').in('id', pagopaIds),
      supabase.from('rateations').select('id, owner_uid, is_quater').in('id', rqIds),
    ]);

    const pMap = new Map((pagopas || []).map(r => [r.id, r]));
    const rMap = new Map((rqs || []).map(r => [r.id, r]));

    const out: OrphanedLink[] = [];
    for (const l of links) {
      const p = pMap.get(l.pagopa_id);
      const r = rMap.get(l.riam_quater_id);
      let issue: OrphanedLink['issue_type'] | null = null;

      if (!p) issue = 'pagopa_missing';
      else if (!r) issue = 'rq_missing';
      else if (p.owner_uid !== r.owner_uid || !r.is_quater) issue = 'access_denied';

      if (issue) out.push({
        link_id: l.id,
        pagopa_id: l.pagopa_id,
        riam_quater_id: l.riam_quater_id,
        allocated_cents: l.allocated_residual_cents || 0,
        issue_type: issue,
      });
    }
    return out;
  } catch (e) {
    console.error('detectOrphanedLinks failed:', e);
    return [];
  }
}

/**
 * Health check completo del sistema RQ allocations
 */
export interface RqAllocationHealthCheck {
  timestamp: string;
  overAllocations: OverAllocationIssue[];
  orphanedLinks: OrphanedLink[];
  totalIssues: number;
  isHealthy: boolean;
  summary: {
    totalPagoPAs: number;
    totalAllocations: number;
    totalAllocatedCents: number;
    averageUtilization: number;
  };
}

export async function performRqHealthCheck(): Promise<RqAllocationHealthCheck> {
  const [overAllocations, orphanedLinks] = await Promise.all([
    detectOverAllocations().catch(err => {
      console.error('Over-allocation check failed:', err);
      return [];
    }),
    detectOrphanedLinks().catch(err => {
      console.error('Orphaned links check failed:', err);
      return [];
    })
  ]);

  // Summary stats
  const { data: summaryData } = await supabase
    .from('v_pagopa_allocations')
    .select('pagopa_id, allocated_cents, residual_cents')
    .not('allocated_cents', 'is', null);

  const summary = {
    totalPagoPAs: summaryData?.length || 0,
    totalAllocations: summaryData?.filter(p => p.allocated_cents > 0).length || 0,
    totalAllocatedCents: summaryData?.reduce((sum, p) => sum + (p.allocated_cents || 0), 0) || 0,
    averageUtilization: summaryData?.length 
      ? summaryData.reduce((sum, p) => {
          const utilization = p.residual_cents > 0 ? (p.allocated_cents || 0) / p.residual_cents : 0;
          return sum + utilization;
        }, 0) / summaryData.length * 100
      : 0
  };

  const totalIssues = overAllocations.length + orphanedLinks.length;

  return {
    timestamp: new Date().toISOString(),
    overAllocations,
    orphanedLinks,
    totalIssues,
    isHealthy: totalIssues === 0,
    summary
  };
}

/**
 * Formatta report di health check per display
 */
export function formatHealthCheckReport(healthCheck: RqAllocationHealthCheck): string {
  const { isHealthy, totalIssues, overAllocations, orphanedLinks, summary } = healthCheck;
  
  let report = `=== RQ Allocation Health Check ===\n`;
  report += `Timestamp: ${new Date(healthCheck.timestamp).toLocaleString('it-IT')}\n`;
  report += `Status: ${isHealthy ? '✅ HEALTHY' : `⚠️ ${totalIssues} ISSUES FOUND`}\n\n`;
  
  report += `Summary:\n`;
  report += `- PagoPA con allocazioni: ${summary.totalAllocations}/${summary.totalPagoPAs}\n`;
  report += `- Totale allocato: € ${(summary.totalAllocatedCents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n`;
  report += `- Utilizzo medio: ${summary.averageUtilization.toFixed(1)}%\n\n`;
  
  if (overAllocations.length > 0) {
    report += `Over-allocations (${overAllocations.length}):\n`;
    overAllocations.forEach(issue => {
      report += `- PagoPA ${issue.pagopa_number}: eccesso € ${(issue.excess_cents / 100).toFixed(2)}\n`;
    });
    report += '\n';
  }
  
  if (orphanedLinks.length > 0) {
    report += `Orphaned links (${orphanedLinks.length}):\n`;
    orphanedLinks.forEach(link => {
      report += `- Link ${link.link_id}: ${link.issue_type}\n`;
    });
  }
  
  return report;
}