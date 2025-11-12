import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client-resilient';
import { BucketValue } from '@/features/rateations/constants/buckets';

export interface DeadlineFilters {
  startDate?: string;
  endDate?: string;
  typeIds?: number[];
  bucket?: string;
  search?: string;
  payFilter?: 'unpaid' | 'paid' | 'all';
}

export interface DeadlineItem {
  id: number;
  rateation_id: number;
  seq: number;
  due_date: string;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  rateation_number: string;
  taxpayer_name: string | null;
  type_name: string;
  type_id: number;
  rateation_status: string;
  due_month: string;
  due_week: string;
  bucket: BucketValue;
  aging_band: '1–7' | '8–30' | '31–60' | '>60' | null;
  days_overdue: number;
  skip_remaining?: number;
  max_skips_effective?: number;
  is_pagopa?: boolean;
  unpaid_overdue_today?: number;
}

export interface DeadlineKPIs {
  total_count: number;
  total_amount: number;
  saldo_da_pagare: number;
  in_ritardo_count: number;
  in_ritardo_amount: number;
  oggi_count: number;
  oggi_amount: number;
  entro_7_count: number;
  entro_7_amount: number;
  entro_30_count: number;
  entro_30_amount: number;
  futuro_count: number;
  futuro_amount: number;
  pagata_count: number;
  pagata_amount: number;
  saldo_per_tipo: {
    f24: number;
    pagopa: number;
    rottamazione_quater: number;
    riammissione_quater: number;
  };
}

export interface MonthlyTrend {
  due_month: string;
  bucket: string;
  count: number;
  amount: number;
}

export function useDeadlines(filters: DeadlineFilters = {}) {
  return useQuery({
    queryKey: ['deadlines', filters],
    queryFn: async (): Promise<DeadlineItem[]> => {
      if (!supabase) {
        return [];
      }
      
      let query = supabase.from('v_scadenze').select('*');

      if (filters.startDate && filters.endDate) {
        query = query.gte('due_date', filters.startDate).lte('due_date', filters.endDate);
      }

      if (filters.typeIds?.length) {
        query = query.in('type_id', filters.typeIds);
      }

      if (filters.bucket && filters.bucket !== 'all') {
        query = query.eq('bucket', filters.bucket as BucketValue);
      }

      if (filters.search) {
        query = query.or(`rateation_number.ilike.%${filters.search}%,taxpayer_name.ilike.%${filters.search}%`);
      }

      // Apply payFilter
      if (filters.payFilter === 'paid') {
        query = query.eq('is_paid', true);
      } else if (filters.payFilter === 'unpaid') {
        query = query.eq('is_paid', false).neq('rateation_status', 'ESTINTA');
      }
      // For 'all' or undefined, no additional filter

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;

      // Arricchimento dati con skip_remaining per PagoPA
      const rateationIds = data?.map(d => d.rateation_id).filter(Boolean) || [];

      if (rateationIds.length > 0) {
        // Query separata per ottenere i KPI PagoPA
        const { data: pagopaKpis } = await supabase
          .from('v_pagopa_today_kpis')
          .select('rateation_id, skip_remaining, max_skips_effective, unpaid_overdue_today')
          .in('rateation_id', rateationIds);

        // Merge dei dati usando rateation_id come chiave
        const enrichedData = data?.map(deadline => {
          const kpi = pagopaKpis?.find(k => k.rateation_id === deadline.rateation_id);
          return {
            ...deadline,
            skip_remaining: kpi?.skip_remaining ?? null,
            max_skips_effective: kpi?.max_skips_effective ?? null,
            is_pagopa: !!kpi,
            unpaid_overdue_today: kpi?.unpaid_overdue_today ?? 0,
          };
        });

        return enrichedData || [];
      }

      return data || [];
    },
  });
}

export function useDeadlineKPIs(filters: DeadlineFilters = {}) {
  return useQuery({
    queryKey: ['deadline-kpis', filters],
    queryFn: async (): Promise<DeadlineKPIs> => {
      let query = supabase.from('v_scadenze').select('bucket, amount, is_paid, rateation_number, taxpayer_name, rateation_status, type_id, type_name');

      if (filters.startDate && filters.endDate) {
        query = query.gte('due_date', filters.startDate).lte('due_date', filters.endDate);
      }

      if (filters.typeIds?.length) {
        query = query.in('type_id', filters.typeIds);
      }

      if (filters.bucket && filters.bucket !== 'all') {
        query = query.eq('bucket', filters.bucket as BucketValue);
      }

      if (filters.search) {
        query = query.or(`rateation_number.ilike.%${filters.search}%,taxpayer_name.ilike.%${filters.search}%`);
      }

      // Apply payFilter
      if (filters.payFilter === 'paid') {
        query = query.eq('is_paid', true);
      } else if (filters.payFilter === 'unpaid') {
        query = query.eq('is_paid', false).neq('rateation_status', 'ESTINTA');
      }

      const { data, error } = await query;

      if (error) throw error;

      const kpis: DeadlineKPIs = {
        total_count: 0,
        total_amount: 0,
        saldo_da_pagare: 0,
        in_ritardo_count: 0,
        in_ritardo_amount: 0,
        oggi_count: 0,
        oggi_amount: 0,
        entro_7_count: 0,
        entro_7_amount: 0,
        entro_30_count: 0,
        entro_30_amount: 0,
        futuro_count: 0,
        futuro_amount: 0,
        pagata_count: 0,
        pagata_amount: 0,
        saldo_per_tipo: {
          f24: 0,
          pagopa: 0,
          rottamazione_quater: 0,
          riammissione_quater: 0,
        },
      };

      data?.forEach((item) => {
        kpis.total_count++;
        kpis.total_amount += item.amount;

        if (!item.is_paid) {
          kpis.saldo_da_pagare += item.amount;
          
          // Classificazione per tipo
          const typeName = (item.type_name || '').toLowerCase().trim();
          
          if (typeName.includes('f24')) {
            kpis.saldo_per_tipo.f24 += item.amount;
          } else if (typeName.includes('pagopa') || typeName.includes('pago pa')) {
            kpis.saldo_per_tipo.pagopa += item.amount;
          } else if (typeName.includes('rottamazione') && typeName.includes('quater')) {
            kpis.saldo_per_tipo.rottamazione_quater += item.amount;
          } else if (typeName.includes('riam') && typeName.includes('quater')) {
            kpis.saldo_per_tipo.riammissione_quater += item.amount;
          }
        }

        switch (item.bucket) {
          case 'In ritardo':
            kpis.in_ritardo_count++;
            kpis.in_ritardo_amount += item.amount;
            break;
          case 'Oggi':
            kpis.oggi_count++;
            kpis.oggi_amount += item.amount;
            break;
          case 'Entro 7 giorni':
            kpis.entro_7_count++;
            kpis.entro_7_amount += item.amount;
            break;
          case 'Entro 30 giorni':
            kpis.entro_30_count++;
            kpis.entro_30_amount += item.amount;
            break;
          case 'Futuro':
            kpis.futuro_count++;
            kpis.futuro_amount += item.amount;
            break;
          case 'Pagata':
            kpis.pagata_count++;
            kpis.pagata_amount += item.amount;
            break;
        }
      });

      return kpis;
    },
  });
}

export function useMonthlyTrends(months: number = 12) {
  return useQuery({
    queryKey: ['monthly-trends', months],
    queryFn: async (): Promise<MonthlyTrend[]> => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);

      const { data, error } = await supabase
        .from('v_scadenze')
        .select('due_month, bucket, amount')
        .gte('due_month', startDate.toISOString().split('T')[0])
        .lte('due_month', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by month and bucket
      const grouped = (data || []).reduce((acc, item) => {
        const key = `${item.due_month}-${item.bucket}`;
        if (!acc[key]) {
          acc[key] = {
            due_month: item.due_month,
            bucket: item.bucket,
            count: 0,
            amount: 0,
          };
        }
        acc[key].count++;
        acc[key].amount += item.amount;
        return acc;
      }, {} as Record<string, MonthlyTrend>);

      return Object.values(grouped).sort((a, b) => a.due_month.localeCompare(b.due_month));
    },
  });
}