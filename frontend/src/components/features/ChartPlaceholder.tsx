import { Icons } from '../icons/Icons'

interface ChartPlaceholderProps {
  symbol?: string
}

export function ChartPlaceholder({ symbol = '' }: ChartPlaceholderProps) {
  return (
    <div className="relative h-[300px] flex flex-col items-center justify-center bg-[var(--bg-elevated)] border border-dashed border-[var(--border-glow)] rounded-md text-[var(--text-muted)] overflow-hidden">
      {/* Animated scan line */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--neon-cyan-dim)] to-transparent opacity-50 animate-chart-scan" />

      <Icons.Chart className="w-12 h-12 mb-3 relative z-[1]" />
      <span className="relative z-[1] text-[13px]">
        Interactive chart with TradingView integration
        {symbol && ` — ${symbol}`}
      </span>
    </div>
  )
}
