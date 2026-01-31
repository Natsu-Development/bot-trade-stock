import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface UiState {
  // Sidebar state
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;

  // Toast state
  toasts: Toast[];

  // Modal state
  activeModal: string | null;

  // Loading overlay
  isGlobalLoading: boolean;
  loadingMessage: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  setActiveModal: (modal: string | null) => void;
  closeModal: () => void;

  setGlobalLoading: (loading: boolean, message?: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Initial state
  isSidebarOpen: true,
  isMobileMenuOpen: false,
  toasts: [],
  activeModal: null,
  isGlobalLoading: false,
  loadingMessage: '',

  // Actions
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, toast.duration || 5000);
    }
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),

  setActiveModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  setGlobalLoading: (loading, message = '') =>
    set({ isGlobalLoading: loading, loadingMessage: message }),
}));
