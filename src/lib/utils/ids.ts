// Converte qualsiasi id supportato (string/number/bigint) in stringa.
// Se nullo o formato inatteso, solleva un errore esplicito per non nascondere bug.
export function ensureStringId(id: unknown): string {
  if (typeof id === 'string') return id;
  if (typeof id === 'number' || typeof id === 'bigint') return String(id);
  throw new Error(`Invalid id: ${String(id)}`);
}