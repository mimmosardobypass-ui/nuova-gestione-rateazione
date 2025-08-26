import { z } from 'zod';

// Adatta lo schema al formato effettivo che salvi in "column_mappings" (jsonb).
// Esempio: record chiave/valore (string->string). Se lo schema reale è diverso, aggiorna qui.
export const ColumnMappingsSchema = z.record(z.string(), z.string()).optional();

export type ProfileRow = {
  id: string | number;
  name: string | null;
  column_mappings: unknown | null;
  created_at: string | null;
  updated_at: string | null;
};

// Tipo target usato nel FE (adatta l'import path se necessario)
export type SavedProfile = {
  id: string;
  name: string;
  columnMappings: Record<string, string>;
  created_at: string | null;
  updated_at: string | null;
};

// Mapper centralizzato con validazione runtime del JSON
export function mapProfile(row: ProfileRow): SavedProfile {
  return {
    id: String(row.id),
    name: row.name ?? '',
    columnMappings: ColumnMappingsSchema.parse(row.column_mappings) ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}