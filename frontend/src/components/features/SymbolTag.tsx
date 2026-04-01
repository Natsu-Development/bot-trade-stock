interface SymbolTagProps {
  symbol: string
  onRemove?: (symbol: string) => void
}

export function SymbolTag({ symbol, onRemove }: SymbolTagProps) {
  const handleRemove = () => {
    onRemove?.(symbol)
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-sm font-mono text-xs text-[var(--text-primary)]">
      {symbol}
      <span
        onClick={handleRemove}
        className="w-3.5 h-3.5 rounded-full bg-[var(--bg-hover)] flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-[var(--neon-bear)] hover:text-white text-[var(--text-muted)]"
      >
        ×
      </span>
    </span>
  )
}

// Wrapper for symbol tags container
export function SymbolTagsContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {children}
    </div>
  )
}
