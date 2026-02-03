import { ReactNode } from 'react'
import { useClock } from '../../hooks/useClock'

interface HeaderProps {
  title: string
  subtitle: string
  actions?: ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const time = useClock()

  return (
    <header className="flex justify-between items-start mb-8 animate-slide-in-from-top">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight mb-1">{title}</h1>
        <p className="text-[var(--text-muted)] text-sm">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="font-mono text-[13px] text-[var(--text-secondary)] bg-[var(--bg-surface)] px-4 py-2 rounded-md border border-[var(--border-dim)]">
          {time}
        </div>
        {actions}
      </div>
    </header>
  )
}
