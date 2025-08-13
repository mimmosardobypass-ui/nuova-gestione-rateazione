import { useCallback, useRef } from "react";

interface DebouncedReloadOptions {
  loadData: () => void;
  reloadStats: () => void;
  debounceMs?: number;
}

export function useDebouncedReload({ 
  loadData, 
  reloadStats, 
  debounceMs = 200 
}: DebouncedReloadOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedReload = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for combined reload
    timeoutRef.current = setTimeout(() => {
      loadData();
      reloadStats();
      timeoutRef.current = null;
    }, debounceMs);
  }, [loadData, reloadStats, debounceMs]);

  const debouncedReloadStats = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for stats only
    timeoutRef.current = setTimeout(() => {
      reloadStats();
      timeoutRef.current = null;
    }, debounceMs);
  }, [reloadStats, debounceMs]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    debouncedReload,
    debouncedReloadStats,
    cleanup
  };
}