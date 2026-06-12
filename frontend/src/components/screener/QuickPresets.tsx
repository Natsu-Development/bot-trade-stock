import { cn } from '@/lib/utils'
import type { QuickPreset } from '../../types'

interface QuickPresetsProps {
  presets: QuickPreset[]
  /** Name of the currently-loaded built-in preset (from provenance), or null. */
  activeName: string | null
  /** The active built-in has been edited away from its baseline. */
  modified: boolean
  onSelectPreset: (preset: QuickPreset) => void
}

export function QuickPresets({ presets, activeName, modified, onSelectPreset }: QuickPresetsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[var(--text-secondary)]">Quick Filters</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => {
          const active = activeName === preset.name
          return (
            <button
              key={preset.id}
              data-active={active ? 'true' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200',
                'bg-[var(--bg-elevated)] border border-[var(--border-dim)] text-[var(--text-secondary)]',
                'hover:bg-[var(--bg-hover)] hover:border-[var(--border-glow)] hover:-translate-y-px',
                active &&
                  'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan)] text-[var(--neon-cyan)]',
                '[&_svg]:w-4 [&_svg]:h-4'
              )}
              onClick={() => onSelectPreset(preset)}
              type="button"
              aria-pressed={active}
            >
              {active && modified && (
                <span
                  aria-hidden="true"
                  title="Modified"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--neon-amber)]"
                />
              )}
              <span>{preset.icon}</span>
              {preset.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
