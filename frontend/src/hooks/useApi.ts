import { useState, useCallback } from 'react';
import { useUiStore } from '../store';

interface UseApiOptions {
  showToasts?: boolean;
  successMessage?: string;
}

export function useApi(options: UseApiOptions = {}) {
  const { showToasts = true, successMessage } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useUiStore();

  const execute = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await asyncFn();
        if (showToasts && successMessage) {
          addToast({ type: 'success', message: successMessage });
        }
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        if (showToasts) {
          addToast({ type: 'error', message: errorMessage });
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [showToasts, successMessage, addToast]
  );

  return { execute, isLoading, error, clearError: () => setError(null) };
}
