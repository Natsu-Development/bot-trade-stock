import './SymbolTag.css'

interface SymbolTagProps {
  symbol: string
  onRemove?: (symbol: string) => void
}

export function SymbolTag({ symbol, onRemove }: SymbolTagProps) {
  const handleRemove = () => {
    onRemove?.(symbol)
  }

  return (
    <span className="symbol-tag">
      {symbol} <span className="remove" onClick={handleRemove}>×</span>
    </span>
  )
}
