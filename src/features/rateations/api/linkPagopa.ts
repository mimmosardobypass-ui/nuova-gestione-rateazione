import { supabase } from '@/integrations/supabase/client';

/**
 * Crea un collegamento tra PagoPA e RQ con quota allocata
 */
export async function linkPagopaToRQ(
  pagopaId: number, 
  rqId: number, 
  allocatedCents: number,
  note?: string
): Promise<void> {
  try {
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

    // 2) Verifica quota disponibile
    const { data: allocation, error: allocationError } = await supabase
      .from('v_pagopa_allocations')
      .select('allocatable_cents')
      .eq('pagopa_id', pagopaId)
      .single();

    if (allocationError) throw allocationError;

    if (!allocation || allocation.allocatable_cents < allocatedCents) {
      throw new Error(`Insufficient allocatable quota. Available: ${allocation?.allocatable_cents || 0}, requested: ${allocatedCents}`);
    }

    // 3) Crea il collegamento con quota allocata
    const { error: insertError } = await supabase
      .from('riam_quater_links')
      .insert({
        pagopa_id: pagopaId,
        riam_quater_id: rqId,
        allocated_residual_cents: allocatedCents,
        reason: note || undefined,
      });

    if (insertError) throw insertError;

    // 4) Trigger per calcolare altri campi viene gestito dal database

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