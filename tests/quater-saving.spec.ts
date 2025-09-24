import { describe, it, expect } from 'vitest';
import { calcQuaterSavingFromLinks } from '@/utils/stats-utils';
import type { RateationRow } from '@/features/rateations/types';

describe('calcQuaterSavingFromLinks - RQ Saving Calculation', () => {
  it('RQ singola: quota > totale', () => {
    const rows = [{
      id: '1',
      is_quater: true,
      allocated_residual_cents: 10_000,   // €100,00
      quater_total_due_cents: 8_000,      // €80,00
      // ... altri campi required minimi
      numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
      residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
      ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
      is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
      original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
      unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
      debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
      rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
    }] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBeCloseTo(20, 2); // €20,00 saving
  });

  it('Due link alla stessa RQ (no doppio conteggio totale)', () => {
    const rows = [{
      id: '1',
      is_quater: true,
      allocated_residual_cents: 10_000,   // due quote sommate (6000 + 4000)
      quater_total_due_cents: 8_000,      // €80,00 totale RQ
      // ... altri campi required minimi
      numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
      residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
      ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
      is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
      original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
      unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
      debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
      rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
    }] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBeCloseTo(20, 2); // €20,00 saving
  });

  it('Quota < totale → saving 0', () => {
    const rows = [{
      id: '1',
      is_quater: true,
      allocated_residual_cents: 3_000,    // €30,00
      quater_total_due_cents: 8_000,      // €80,00
      // ... altri campi required minimi
      numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
      residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
      ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
      is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
      original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
      unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
      debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
      rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
    }] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBe(0); // Nessun saving
  });

  it('RQ senza link → saving 0 (allocated_residual_cents = 0)', () => {
    const rows = [{
      id: '1',
      is_quater: true,
      allocated_residual_cents: 0,        // Nessuna quota allocata
      quater_total_due_cents: 8_000,      // €80,00
      // ... altri campi required minimi
      numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
      residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
      ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
      is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
      original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
      unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
      debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
      rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
    }] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBe(0);
  });

  it('Valori null/undefined → gestione safe', () => {
    const rows = [{
      id: '1',
      is_quater: true,
      allocated_residual_cents: null,      // Valore null
      quater_total_due_cents: undefined,   // Valore undefined
      // ... altri campi required minimi
      numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
      residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
      ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
      is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
      original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
      unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
      debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
      rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
    }] as any[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBe(0);
  });

  it('Multe RQ diverse → somma savings correttamente', () => {
    const rows = [
      {
        id: '1',
        is_quater: true,
        allocated_residual_cents: 10_000,   // €100,00
        quater_total_due_cents: 8_000,      // €80,00 → saving €20
        // ... altri campi required minimi
        numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
        residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
        ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
        is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
        original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
        unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
        debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
        rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
      },
      {
        id: '2',
        is_quater: true,
        allocated_residual_cents: 15_000,   // €150,00
        quater_total_due_cents: 12_000,     // €120,00 → saving €30
        // ... altri campi required minimi
        numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
        residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
        ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
        is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
        original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
        unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
        debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
        rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
      }
    ] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBeCloseTo(50, 2); // €20 + €30 = €50 totale
  });

  it('Mix RQ e non-RQ → filtra solo RQ', () => {
    const rows = [
      {
        id: '1',
        is_quater: true,
        allocated_residual_cents: 10_000,
        quater_total_due_cents: 8_000,
        // ... altri campi required minimi
        numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
        residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
        ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
        is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
        original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
        unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
        debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
        rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
      },
      {
        id: '2',
        is_quater: false, // Non-RQ (dovrebbe essere ignorata)
        allocated_residual_cents: 50_000,
        quater_total_due_cents: 10_000,
        // ... altri campi required minimi
        numero: '', tipo: '', contribuente: '', importoTotale: 0, importoPagato: 0,
        residuo: 0, residuoEffettivo: 0, importoRitardo: 0, rateTotali: 0, 
        ratePagate: 0, rateNonPagate: 0, rateInRitardo: 0, status: 'ATTIVA',
        is_pagopa: false, is_f24: false, type_id: 0, type_name: '', ratePaidLate: 0,
        original_total_due_cents: 0, rq_total_at_link_cents: 0, unpaid_overdue_today: 0,
        unpaid_due_today: 0, max_skips_effective: 8, skip_remaining: 8, at_risk_decadence: false,
        debts_total: 0, debts_migrated: 0, migrated_debt_numbers: [], remaining_debt_numbers: [],
        rq_target_ids: [], rq_migration_status: 'none', excluded_from_stats: false
      }
    ] as RateationRow[];
    
    const result = calcQuaterSavingFromLinks(rows);
    expect(result.quaterSaving).toBeCloseTo(20, 2); // Solo la prima RQ conta
  });
});