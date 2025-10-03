/**
 * LocalStorage persistence for Stats filters and layout
 * TTL: 30 days
 */

import type { StatsFilters, CollapsedSections } from '../types/stats';

const FILTERS_KEY = 'stats:filters:v1';
const LAYOUT_KEY = 'stats:layout:v1';
const TTL_DAYS = 30;

interface StoredData<T> {
  data: T;
  timestamp: number;
}

function isExpired(timestamp: number): boolean {
  const now = Date.now();
  const ttl = TTL_DAYS * 24 * 60 * 60 * 1000;
  return now - timestamp > ttl;
}

export function getDefaultFilters(): StatsFilters {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);

  return {
    startDate: startOfYear.toISOString().split('T')[0],
    endDate: endOfYear.toISOString().split('T')[0],
    typeLabels: null,
    statuses: null,
    taxpayerSearch: null,
    ownerOnly: true,
  };
}

export function saveFilters(filters: StatsFilters): void {
  const stored: StoredData<StatsFilters> = {
    data: filters,
    timestamp: Date.now(),
  };
  localStorage.setItem(FILTERS_KEY, JSON.stringify(stored));
}

export function loadFilters(): StatsFilters {
  try {
    const item = localStorage.getItem(FILTERS_KEY);
    if (!item) return getDefaultFilters();

    const stored: StoredData<StatsFilters> = JSON.parse(item);
    if (isExpired(stored.timestamp)) {
      localStorage.removeItem(FILTERS_KEY);
      return getDefaultFilters();
    }

    return stored.data;
  } catch {
    return getDefaultFilters();
  }
}

export function getDefaultLayout(): CollapsedSections {
  return {
    kpis: false,
    charts: false,
    tables: false,
  };
}

export function saveLayout(layout: CollapsedSections): void {
  const stored: StoredData<CollapsedSections> = {
    data: layout,
    timestamp: Date.now(),
  };
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(stored));
}

export function loadLayout(): CollapsedSections {
  try {
    const item = localStorage.getItem(LAYOUT_KEY);
    if (!item) return getDefaultLayout();

    const stored: StoredData<CollapsedSections> = JSON.parse(item);
    if (isExpired(stored.timestamp)) {
      localStorage.removeItem(LAYOUT_KEY);
      return getDefaultLayout();
    }

    return stored.data;
  } catch {
    return getDefaultLayout();
  }
}
