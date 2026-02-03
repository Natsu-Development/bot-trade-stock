import { ReactNode } from 'react'

interface SettingsItemProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function SettingsItem({ icon, title, description, action }: SettingsItemProps) {
  return (
    <div className="flex justify-between items-center px-5 py-4 bg-[var(--bg-surface)]">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 [&_svg]:flex-shrink-0 [&_svg]:text-[var(--text-secondary)]">
          {icon}
        </div>
        <div>
          <div className="font-medium mb-0.5 text-[var(--text-primary)]">{title}</div>
          <div className="text-xs text-[var(--text-muted)]">{description}</div>
        </div>
      </div>
      {action}
    </div>
  )
}

// Wrapper for settings list
export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-px bg-[var(--border-dim)] rounded-lg overflow-hidden">
      {children}
    </div>
  )
}
