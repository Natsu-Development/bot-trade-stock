import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import { Input } from '../ui/input'

interface SymbolSearchInputProps {
  value: string
  onChange: (value: string) => void
  /** Fired on Enter or when a suggestion is picked — load that symbol. */
  onSubmit: (value: string) => void
  /** Symbol universe for suggestions (already cached; same source as the config search). */
  options: string[]
  placeholder?: string
  className?: string
  'data-testid'?: string
}

const MAX_SUGGESTIONS = 8

/**
 * A search field for stock symbols: visibly styled as an input (background +
 * border + search icon) so it's clearly typeable, with a cache-backed suggestion
 * dropdown (Arrow/Enter/Escape keyboard nav + click) — mirroring the Config-page
 * watchlist symbol search.
 */
export const SymbolSearchInput = memo(function SymbolSearchInput({
  value,
  onChange,
  onSubmit,
  options,
  placeholder = 'Search symbol…',
  className,
  'data-testid': testId,
}: SymbolSearchInputProps) {
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel a pending blur timer on unmount so the deferred setFocused(false)
  // never fires on an unmounted component.
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    },
    []
  )

  const query = value.trim().toUpperCase()
  const suggestions = useMemo(() => {
    if (!query) return []
    // Single pass: prefix matches first, then substring-only matches (same order
    // as two filters, but one scan of the symbol universe instead of two).
    const starts: string[] = []
    const contains: string[] = []
    for (const s of options) {
      if (s.startsWith(query)) starts.push(s)
      else if (s.includes(query)) contains.push(s)
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }, [query, options])

  const open = focused && suggestions.length > 0

  const pick = (sym: string) => {
    onChange(sym)
    onSubmit(sym)
    setActive(-1)
    setFocused(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (open && active >= 0 && active < suggestions.length) pick(suggestions[active])
      else onSubmit(value)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
      setActive(-1)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
          setActive(-1)
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so a suggestion click registers before the dropdown closes.
          blurTimer.current = setTimeout(() => setFocused(false), 120)
        }}
        placeholder={placeholder}
        aria-label="Search symbol"
        aria-autocomplete="list"
        data-testid={testId}
        startIcon={<Icons.Search className="w-3.5 h-3.5" />}
        className="h-8 w-36 text-[13px] font-semibold uppercase bg-[var(--bg-secondary)] placeholder:font-normal placeholder:normal-case"
      />
      {open && (
        <ul
          data-testid="symbol-suggestions"
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-44 overflow-auto rounded-md border border-[var(--border-dim)] bg-[var(--bg-elevated)] py-1 shadow-lg"
          onMouseDown={(e) => {
            // Keep focus so the input's blur doesn't fire before the click handler.
            e.preventDefault()
            if (blurTimer.current) clearTimeout(blurTimer.current)
          }}
        >
          {suggestions.map((sym, i) => (
            <li key={sym}>
              <button
                type="button"
                data-testid={`symbol-suggestion-${sym}`}
                onClick={() => pick(sym)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'block w-full px-3 py-1.5 text-left text-[13px] font-semibold',
                  i === active
                    ? 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                )}
              >
                {sym}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
