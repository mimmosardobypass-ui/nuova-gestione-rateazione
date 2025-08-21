// Valori che SALVANO/LEGGONO dal DB (devono combaciare con v_scadenze.bucket)
export const BUCKET_VALUES = [
  'In ritardo',
  'Oggi',
  'Entro 7 giorni',
  'Entro 30 giorni',
  'Futuro',
  'Pagata',
] as const;

export type BucketValue = typeof BUCKET_VALUES[number];

// Opzioni UI: label mostrate vs valore DB
export const BUCKET_OPTIONS: Array<{ value: 'all' | BucketValue; label: string }> = [
  { value: 'all',            label: 'Tutti gli stati' },
  { value: 'In ritardo',     label: 'In ritardo' },
  { value: 'Oggi',           label: 'Scadono oggi' },   // label diverso ma value = "Oggi"
  { value: 'Entro 7 giorni', label: 'Entro 7 giorni' },
  { value: 'Entro 30 giorni',label: 'Entro 30 giorni' },
  { value: 'Futuro',         label: 'Future' },         // label inglese ok, value italiano = "Futuro"
  { value: 'Pagata',         label: 'Pagate' },
];

// Colori, chiave = valore DB
export const BUCKET_COLORS: Record<BucketValue, string> = {
  'In ritardo':     'hsl(var(--destructive))',
  'Oggi':           'hsl(var(--warning-foreground))',
  'Entro 7 giorni': 'hsl(var(--warning))',
  'Entro 30 giorni':'hsl(var(--accent))',
  'Futuro':         'hsl(var(--primary))',
  'Pagata':         'hsl(var(--success))',
};