import { create } from 'zustand';
import { StockMetrics } from '../services';

interface StockState {
  // Data
  stocks: StockMetrics[];
  filteredStocks: StockMetrics[];
  totalStocks: number;
  filteredCount: number;
  cacheInfo: {
    cached: boolean;
    cached_at?: string;
    total_stocks?: number;
  };

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  isFiltering: boolean;

  // Error state
  error: string | null;

  // Actions
  setStocks: (stocks: StockMetrics[]) => void;
  setFilteredStocks: (stocks: StockMetrics[]) => void;
  setCacheInfo: (info: StockState['cacheInfo']) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setFiltering: (filtering: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useStockStore = create<StockState>((set) => ({
  // Initial state
  stocks: [],
  filteredStocks: [],
  totalStocks: 0,
  filteredCount: 0,
  cacheInfo: {
    cached: false,
  },
  isLoading: false,
  isRefreshing: false,
  isFiltering: false,
  error: null,

  // Actions
  setStocks: (stocks) => set({ stocks, totalStocks: stocks.length }),
  setFilteredStocks: (stocks) => set({ filteredStocks: stocks, filteredCount: stocks.length }),
  setCacheInfo: (info) => set({ cacheInfo: info }),
  setLoading: (loading) => set({ isLoading: loading }),
  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  setFiltering: (filtering) => set({ isFiltering: filtering }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
