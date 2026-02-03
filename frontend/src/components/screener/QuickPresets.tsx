import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { QuickPreset } from '../../types'

interface QuickPresetsProps {
  presets: QuickPreset[]
  activePresetId: string | null
  onSelectPreset: (preset: QuickPreset) => void
  onSaveCurrent: () => void
}

export function QuickPresets({
  presets,
  activePresetId,
  onSelectPreset,
  onSaveCurrent,
}: QuickPresetsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[var(--text-secondary)]">Quick Filters</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-200',
              'bg-[var(--bg-elevated)] border border-[var(--border-dim)] text-[var(--text-secondary)]',
              'hover:bg-[var(--bg-hover)] hover:border-[var(--border-glow)] hover:-translate-y-px',
              activePresetId === preset.id && 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan)] text-[var(--neon-cyan)]',
              '[&_svg]:w-4 [&_svg]:h-4'
            )}
            onClick={() => onSelectPreset(preset)}
            type="button"
          >
            <span dangerouslySetInnerHTML={{ __html: preset.icon }} />
            {preset.name}
          </button>
        ))}
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-dashed border-[var(--border-dim)] rounded-full text-[13px] font-medium text-[var(--text-muted)] cursor-pointer transition-all duration-200 hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] [&_svg]:w-4 [&_svg]:h-4"
          onClick={onSaveCurrent}
          type="button"
        >
          <Icons.Plus />
          Save Current
        </button>
      </div>
    </div>
  )
}
