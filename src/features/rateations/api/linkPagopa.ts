import { supabase } from '@/integrations/supabase/client';

/**
 * Crea o aggiorna un collegamento tra PagoPA e RQ con quota allocata
 */
export async function linkPagopaToRQ(
  pagopaId: number, 
  rqId: number, 
  allocatedCents: number,
  note?: string
): Promise<void> {
  try {
    // Guardia: quota deve essere positiva
    if (allocatedCents <= 0) {
      throw new Error('Allocated quota must be greater than 0');
    }

    // 1) Verifica che l'utente possieda entrambe le rateazioni
    const { data: userRateations, error: ownershipError } = await supabase
      .from('rateations')
      .select('id, owner_uid')
      .in('id', [pagopaId, rqId]);

    if (ownershipError) throw ownershipError;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const ownedIds = userRateations
      ?.filter(r => r.owner_uid === user.id)
      .map(r => r.id) || [];

    if (!ownedIds.includes(pagopaId) || !ownedIds.includes(rqId)) {
      throw new Error('Access denied to one or both rateations');
    }

    // 2) Verifica quota disponibile (escludendo allocazione corrente per upsert)
    const { data: allocation, error: allocationError } = await supabase
      .from('v_pagopa_allocations')
      .select('allocatable_cents, residual_cents')
      .eq('pagopa_id', pagopaId)
      .single();

    if (allocationError) throw allocationError;

    // Per upsert: considera quota già allocata a questa RQ
    const { data: existingLink } = await supabase
      .from('riam_quater_links')
      .select('allocated_residual_cents')
      .eq('pagopa_id', pagopaId)
      .eq('riam_quater_id', rqId)
      .maybeSingle();

    const currentAllocation = existingLink?.allocated_residual_cents || 0;
    const availableQuota = (allocation?.allocatable_cents || 0) + currentAllocation;

    if (availableQuota < allocatedCents) {
      throw new Error(`Insufficient allocatable quota. Available: ${availableQuota}, requested: ${allocatedCents}`);
    }

    // 3) Upsert: crea o aggiorna il collegamento
    const { error: upsertError } = await supabase
      .from('riam_quater_links')
      .upsert({
        pagopa_id: pagopaId,
        riam_quater_id: rqId,
        allocated_residual_cents: allocatedCents,
        reason: note || undefined,
      }, {
        onConflict: 'riam_quater_id,pagopa_id'
      });

    if (upsertError) throw upsertError;

    // 4) Logging per osservabilità
    console.log('RQ allocation upsert:', {
      pagopaId,
      rqId,
      allocatedCents,
      previousAllocation: currentAllocation,
      userId: user.id,
      action: existingLink ? 'update' : 'create'
    });

    // 5) Trigger per calcolare altri campi viene gestito dal database

  } catch (error) {
    console.error('Error linking PagoPA to RQ:', error);
    throw error;
  }
}

/**
 * Rimuove un collegamento specifico tra PagoPA e RQ
 */
export async function unlinkPagopaFromRQ(
  pagopaId: number, 
  rqId: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('riam_quater_links')
      .delete()
      .eq('pagopa_id', pagopaId)
      .eq('riam_quater_id', rqId);

    if (error) throw error;

  } catch (error) {
    console.error('Error unlinking PagoPA from RQ:', error);
    throw error;
  }
}

/**
 * Ottiene i collegamenti esistenti per una PagoPA
 */
export async function getPagopaLinks(pagopaId: number) {
  try {
    const { data, error } = await supabase
      .from('riam_quater_links')
      .select(`
        *,
        rq:riam_quater_id (
          id,
          number,
          taxpayer_name
        )
      `)
      .eq('pagopa_id', pagopaId);

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('Error fetching PagoPA links:', error);
    throw error;
  }
}