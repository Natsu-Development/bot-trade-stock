import { useState, useEffect, useCallback, useRef, InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
  debounceMs?: number
}

/**
 * A number input that uses local state to avoid re-renders on every keystroke.
 * Updates parent state on blur or after debounce delay.
 */
export function NumberInput({
  value,
  onChange,
  debounceMs = 300,
  className,
  ...props
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value.toString())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFocusedRef = useRef(false)

  // Sync local value when external value changes (but not while focused)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value.toString())
    }
  }, [value])

  const commitValue = useCallback((stringValue: string) => {
    // If empty, don't auto-fill default - let user clear the field
    if (stringValue === '') {
      onChange(0)
      setLocalValue('')
      return
    }
    const parsed = parseFloat(stringValue)
    if (isNaN(parsed)) {
      // Invalid input - restore to current value
      setLocalValue(value.toString())
      return
    }
    onChange(parsed)
    setLocalValue(parsed.toString())
  }, [value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce the update
    debounceRef.current = setTimeout(() => {
      commitValue(newValue)
    }, debounceMs)
  }

  const handleBlur = () => {
    isFocusedRef.current = false

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    commitValue(localValue)
  }

  const handleFocus = () => {
    isFocusedRef.current = true
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <input
      type="number"
      className={className}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      {...props}
    />
  )
}