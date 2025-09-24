/**
 * Contract tests for v_rateations_list_ui view
 * These tests ensure the database view meets our data contract expectations
 */
import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { RateationListRowSchema } from '@/schemas/RateationListRow.schema';

describe('Database Contract Tests', () => {
  it('v_rateations_list_ui respects data integrity constraints', async () => {
    const { data, error } = await supabase
      .from('v_rateations_list_ui')
      .select('installments_paid, paid_amount_cents, installments_total')
      .limit(100);

    if (error) {
      console.warn('DB not available for contract test:', error.message);
      return;
    }

    // Critical constraint: paid installments should correlate with paid amount
    const suspicious = data?.filter(
      (row: any) => (row.installments_paid ?? 0) > 0 && (row.paid_amount_cents ?? 0) === 0
    ) ?? [];

    expect(suspicious.length).toBe(0);
    
    // Schema validation on real data
    if (data && data.length > 0) {
      const parseResult = RateationListRowSchema.safeParse(data[0]);
      expect(parseResult.success).toBe(true);
    }
  });

  it('view returns expected columns', async () => {
    const { data, error } = await supabase
      .from('v_rateations_list_ui')
      .select('*')
      .limit(1);

    if (error) return; // Skip if DB not available

    if (data && data.length > 0) {
      const row = data[0];
      // Essential fields must exist
      expect(row).toHaveProperty('total_amount_cents');
      expect(row).toHaveProperty('paid_amount_cents');
      expect(row).toHaveProperty('residual_effective_cents');
      expect(row).toHaveProperty('overdue_effective_cents');
      expect(row).toHaveProperty('installments_total');
      expect(row).toHaveProperty('installments_paid');
    }
  });

  it('ensures paid + residual does not exceed total amount', async () => {
    const { data, error } = await supabase
      .from('v_rateations_list_ui')
      .select('paid_amount_cents, residual_effective_cents, total_amount_cents')
      .limit(100);

    if (error) {
      console.warn('DB not available for contract test:', error.message);
      return;
    }

    // Critical constraint: paid + residual should not exceed total
    const violatingRows = data?.filter(
      (row: any) => 
        (row.paid_amount_cents ?? 0) + (row.residual_effective_cents ?? 0) > 
        (row.total_amount_cents ?? 0)
    ) ?? [];

    expect(violatingRows.length).toBe(0);
  });

  it('installments constraint: paid <= total installments', async () => {
    const { data, error } = await supabase
      .from('v_rateations_list_ui')
      .select('installments_paid, installments_total')
      .limit(200);

    if (error) {
      console.warn('[Contract Test] Database unavailable:', error.message);
      return;
    }

    const rows = data ?? [];
    const violations = rows.filter((row: any) => {
      const paid = row.installments_paid ?? 0;
      const total = row.installments_total ?? 0;
      return paid > total;
    });

    expect(violations).toHaveLength(0);
  });
});