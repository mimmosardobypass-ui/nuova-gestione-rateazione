/**
 * Feature flags for development and production control
 */

export const shouldShowHealthBanner = (): boolean => {
  // Vite environment
  const viteFlag = typeof import.meta !== "undefined" && 
    (import.meta as any).env?.VITE_SHOW_HEALTH;
  
  // Next.js environment (future compatibility)
  const nextFlag = typeof process !== "undefined" && 
    process.env?.NEXT_PUBLIC_SHOW_HEALTH;
  
  // Development mode
  const isDev = typeof process !== "undefined" && 
    process.env.NODE_ENV === "development";
  
  return isDev || viteFlag === "true" || nextFlag === "true";
};