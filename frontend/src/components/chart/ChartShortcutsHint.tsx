import { memo } from 'react'

export const ChartShortcutsHint = memo(function ChartShortcutsHint() {
  return (
    <div className="absolute bottom-3 right-3 bg-[var(--bg-overlay)]/80 backdrop-blur-sm rounded-lg px-2 py-1.5 text-[10px] text-[var(--text-muted)] border border-[var(--border-primary)]/20 shadow-lg">
      <span className="font-mono">Wheel</span> zoom
      <span className="mx-1.5 text-[var(--border-primary)]/30">|</span>
      <span className="font-mono">Drag</span> pan
      <span className="mx-1.5 text-[var(--border-primary)]/30">|</span>
      <span className="font-mono">+/-</span> zoom
      <span className="mx-1.5 text-[var(--border-primary)]/30">|</span>
      <span className="font-mono">R</span> reset
    </div>
  )
})
