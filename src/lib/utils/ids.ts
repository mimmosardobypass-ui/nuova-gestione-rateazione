// Converte qualsiasi id supportato (string/number/bigint) in stringa.
// Se nullo o formato inatteso, solleva un errore esplicito per non nascondere bug.
export function ensureStringId(id: unknown): string {
  if (typeof id === 'string') return id;
  if (typeof id === 'number' || typeof id === 'bigint') return String(id);
  throw new Error(`Invalid id: ${String(id)}`);
}

/**
 * Converte un ID (string | number) in numero intero sicuro per Supabase
 * Evita parseInt sparso: centralizza la conversione con guard completa
 * @param id - L'ID da convertire (string o number)
 * @param label - Etichetta per messaggi d'errore più chiari
 * @returns numero intero valido
 * @throws Error se l'ID non è convertibile in intero valido
 */
export function toIntId(id: string | number, label = 'id'): number {
  if (typeof id === 'number') {
    if (Number.isInteger(id) && Number.isFinite(id)) return id;
    throw new Error(`${label} non è un intero valido: ${id}`);
  }
  
  const n = Number.parseInt(id, 10); // Base 10 esplicita
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} non valido: "${id}"`);
  }
  return n;
}