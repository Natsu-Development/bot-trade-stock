import { useUiStore } from '@/store';

export function useToast() {
  const { addToast, removeToast, clearToasts } = useUiStore();

  const success = (message: string, duration?: number) => {
    addToast({ type: 'success', message, duration });
  };

  const error = (message: string, duration?: number) => {
    addToast({ type: 'error', message, duration });
  };

  const warning = (message: string, duration?: number) => {
    addToast({ type: 'warning', message, duration });
  };

  const info = (message: string, duration?: number) => {
    addToast({ type: 'info', message, duration });
  };

  return {
    success,
    error,
    warning,
    info,
    remove: removeToast,
    clear: clearToasts,
  };
}
