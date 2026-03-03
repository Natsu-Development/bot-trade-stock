import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { Page } from '../../types'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems = [
  { id: 'dashboard' as Page, icon: Icons.Dashboard, label: 'Dashboard' },
  { id: 'screener' as Page, icon: Icons.Search, label: 'Screener' },
  { id: 'divergence' as Page, icon: Icons.Chart, label: 'Divergence' },
  { id: 'config' as Page, icon: Icons.Settings, label: 'Config' },
  { id: 'settings' as Page, icon: Icons.Sliders, label: 'Settings' },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed top-0 left-0 bottom-0 z-[100] w-[72px] flex flex-col items-center py-5 bg-[var(--bg-surface)] border-r border-[var(--border-dim)]">
      {/* Logo */}
      <div className="w-11 h-11 mb-8 flex items-center justify-center rounded-md font-mono font-bold text-[16px] text-[var(--bg-void)] bg-gradient-to-br from-[var(--neon-bull)] to-[var(--neon-cyan)] shadow-[var(--neon-bull-glow)] animate-logo-pulse">
        VN
      </div>

      {/* Navigation Items */}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => {
          const isActive = currentPage === item.id
          return (
            <div
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group relative w-12 h-12 flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 border border-transparent',
                'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]',
                '[&_svg]:w-[22px] [&_svg]:h-[22px] [&_svg]:flex-shrink-0',
                isActive && [
                  'bg-[var(--bg-elevated)] text-[var(--neon-cyan)] border-[var(--neon-cyan)]',
                  'shadow-[inset_0_0_20px_var(--neon-cyan-dim)]',
                  'before:absolute before:left-[-13px] before:top-1/2 before:-translate-y-1/2',
                  'before:w-[3px] before:h-6 before:bg-[var(--neon-cyan)] before:rounded-r-sm',
                  'before:shadow-[var(--neon-cyan-glow)]'
                ]
              )}
            >
              <item.icon />
              {/* Tooltip */}
              <span className="absolute left-[60px] px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-medium whitespace-nowrap rounded-sm border border-[var(--border-glow)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[1000]">
                {item.label}
              </span>
            </div>
          )
        })}
      </nav>

      {/* Footer / Status Indicator */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="group relative w-12 h-12 flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--neon-bull)] shadow-[0_0_10px_var(--neon-bull)] animate-status-blink flex-shrink-0" />
          <span className="absolute left-[60px] px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs font-medium whitespace-nowrap rounded-sm border border-[var(--border-glow)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[1000]">
            API Connected
          </span>
        </div>
      </div>
    </aside>
  )
}
