import { useState, useEffect, useCallback } from 'react'
import { api, setConfigId as setApiConfigId, getConfigId } from '../lib/api'

const STORAGE_KEY = 'trading-app_config-id'

/**
 * Client-side validation for config ID (username)
 * Must be alphanumeric with hyphens and underscores allowed
 */
function validateConfigId(id: string): { valid: boolean; error?: string } {
  const trimmed = id.trim()

  if (!trimmed) {
    return { valid: false, error: 'Username is required' }
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' }
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Username must be less than 50 characters' }
  }

  // Allow alphanumeric, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Only letters, numbers, hyphens, and underscores allowed' }
  }

  return { valid: true }
}

interface UseConfigIdReturn {
  configId: string | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  setConfigId: (id: string) => Promise<boolean>
  clearConfigId: () => void
}

/**
 * Custom hook for managing config ID (username) state with localStorage persistence
 */
export function useConfigId(): UseConfigIdReturn {
  const [configId, setConfigIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load config ID from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setConfigIdState(stored)
        // Sync with API client
        setApiConfigId(stored)
      }
    } catch {
      // localStorage might be disabled
      setError('Failed to load saved username')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setConfigId = useCallback(async (id: string): Promise<boolean> => {
    // Client-side validation
    const validation = validateConfigId(id)
    if (!validation.valid) {
      setError(validation.error || 'Invalid username')
      return false
    }

    const trimmed = id.trim()

    try {
      // Try to get existing config
      await api.getConfig(trimmed)
    } catch (err) {
      // Config doesn't exist - create it
      try {
        await api.createConfig(trimmed)
      } catch (createErr) {
        const message = createErr instanceof Error ? createErr.message : 'Failed to create config'
        setError(message)
        return false
      }
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, trimmed)
    setConfigIdState(trimmed)
    setApiConfigId(trimmed)
    setError(null)
    return true
  }, [])

  const clearConfigId = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setConfigIdState(null)
      setApiConfigId('default')
      setError(null)
    } catch {
      setError('Failed to clear username')
    }
  }, [])

  return {
    configId,
    isLoading,
    error,
    isAuthenticated: configId !== null,
    setConfigId,
    clearConfigId,
  }
}

/**
 * Initialize config ID from localStorage on module load
 * Call this early in app initialization to sync localStorage with API client
 */
export function initConfigId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setApiConfigId(stored)
      return stored
    }
  } catch {
    // localStorage might be disabled
  }
  return getConfigId() // Returns current default
}
