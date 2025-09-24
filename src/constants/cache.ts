/**
 * Versioned cache keys for data consistency
 * Bump version when view schema or mapping logic changes
 */

// Main rateations list cache - tied to v_rateations_list_ui schema
export const RATEATIONS_CACHE_KEY = "rateations:list_ui:v7";

// Cache TTL in milliseconds (5 minutes)
export const CACHE_TTL = 5 * 60 * 1000;

// Version history:
// v7: Added Zod validation + centralized mapping (2024-01)
// v6: Added quater fields to schema
// v5: Added installments_overdue_today field