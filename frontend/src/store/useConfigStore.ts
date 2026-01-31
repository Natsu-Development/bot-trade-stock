import { create } from 'zustand';
import { TradingConfig } from '../services';

interface ConfigState {
  // Data
  configs: TradingConfig[];
  activeConfig: TradingConfig | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // UI state
  isModalOpen: boolean;
  editingConfig: TradingConfig | null;

  // Actions
  setConfigs: (configs: TradingConfig[]) => void;
  setActiveConfig: (config: TradingConfig | null) => void;
  addConfig: (config: TradingConfig) => void;
  updateConfig: (id: string, config: TradingConfig) => void;
  removeConfig: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setDeleting: (deleting: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setModalOpen: (open: boolean) => void;
  setEditingConfig: (config: TradingConfig | null) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  // Initial state
  configs: [],
  activeConfig: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  isModalOpen: false,
  editingConfig: null,

  // Actions
  setConfigs: (configs) => set({ configs }),
  setActiveConfig: (config) => set({ activeConfig: config }),
  addConfig: (config) => set((state) => ({ configs: [...state.configs, config] })),
  updateConfig: (id, config) =>
    set((state) => ({
      configs: state.configs.map((c) => (c.id === id ? config : c)),
      activeConfig: state.activeConfig?.id === id ? config : state.activeConfig,
    })),
  removeConfig: (id) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.id !== id),
      activeConfig: state.activeConfig?.id === id ? null : state.activeConfig,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),
  setDeleting: (deleting) => set({ isDeleting: deleting }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setModalOpen: (open) => set({ isModalOpen: open }),
  setEditingConfig: (config) => set({ editingConfig: config }),
}));
