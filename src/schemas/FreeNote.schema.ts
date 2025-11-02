import { z } from 'zod';

export const freeNoteSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Il titolo è obbligatorio")
    .max(100, "Il titolo non può superare 100 caratteri"),
  content: z.string()
    .trim()
    .min(1, "Il contenuto è obbligatorio")
    .max(2000, "Il contenuto non può superare 2000 caratteri")
});

export type FreeNoteFormData = z.infer<typeof freeNoteSchema>;
