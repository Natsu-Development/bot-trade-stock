/**
 * Centralized error handling utilities for the trading application
 */

import { toast } from '../components/ui/Toast'

export type ErrorSeverity = 'low' | 'medium' | 'high'

export interface AppError {
  message: string
  severity: ErrorSeverity
  userMessage?: string
  code?: string
  originalError?: unknown
}

// Internal helper: Check if an error is a network error
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    )
  }
  return false
}

// Internal helper: Check if an error is an API error
function isApiError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('HTTP') ||
      error.message.includes('404') ||
      error.message.includes('500') ||
      error.message.includes('401') ||
      error.message.includes('403')
    )
  }
  return false
}

// Internal helper: Normalize any error into a consistent AppError format
function normalizeError(error: unknown, context?: string): AppError {
  // Already normalized
  if (typeof error === 'object' && error !== null && 'message' in error && 'severity' in error) {
    return error as AppError
  }

  // Error instance
  if (error instanceof Error) {
    const message = error.message

    if (isNetworkError(error)) {
      return {
        message,
        severity: 'high',
        userMessage: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
        originalError: error,
      }
    }

    if (isApiError(error)) {
      return {
        message,
        severity: 'medium',
        userMessage: 'Server error. Please try again later.',
        code: 'API_ERROR',
        originalError: error,
      }
    }

    return {
      message,
      severity: 'medium',
      userMessage: context ? `Error in ${context}: ${message}` : message,
      originalError: error,
    }
  }

  // String error
  if (typeof error === 'string') {
    return {
      message: error,
      severity: 'medium',
      userMessage: error,
    }
  }

  // Unknown error type
  return {
    message: 'An unknown error occurred',
    severity: 'medium',
    userMessage: 'Something went wrong. Please try again.',
    originalError: error,
  }
}

// Internal helper: Log error to console with appropriate level
function logError(error: AppError): void {
  const { severity, message, originalError } = error

  switch (severity) {
    case 'low':
      console.debug(`[App] ${message}`, originalError)
      break
    case 'medium':
      console.warn(`[App] ${message}`, originalError)
      break
    case 'high':
      console.error(`[App] ${message}`, originalError)
      break
  }
}

// Internal helper: Get user-friendly error message
function getUserMessage(error: AppError): string {
  return error.userMessage || error.message
}

// Internal helper: Show error as toast notification
function showErrorAsToast(error: AppError): void {
  const userMessage = getUserMessage(error)

  switch (error.severity) {
    case 'low':
      toast.info(userMessage)
      break
    case 'medium':
      toast.warning(userMessage)
      break
    case 'high':
      toast.error(userMessage)
      break
  }
}

/**
 * Handle error with logging and optional toast notification
 */
export function handleError(
  error: unknown,
  context?: string,
  options: { showToast?: boolean; severity?: ErrorSeverity } = {}
): AppError {
  const normalizedError = normalizeError(error, context)

  // Override severity if provided
  if (options.severity) {
    normalizedError.severity = options.severity
  }

  logError(normalizedError)

  if (options.showToast !== false) {
    showErrorAsToast(normalizedError)
  }

  return normalizedError
}
