import { cn } from '@/lib/utils'
import { Icons } from '../icons/Icons'
import type { SignalType } from '../../types'

interface SignalCardProps {
  type: SignalType
  title: string
  value: string
  currentRsi: number
  confidence: number
  divergenceType: string
  strength: string
}

export function SignalCard({
  type,
  title,
  value,
  currentRsi,
  confidence,
  divergenceType,
  strength
}: SignalCardProps) {
  const Icon = type === 'bullish' ? Icons.TrendUp : Icons.TrendDown
  const isBullish = type === 'bullish'

  return (
    <div
      className={cn(
        'relative overflow-hidden p-6 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-dim)] text-center',
        // Top border gradient
        'before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px]',
        isBullish
          ? 'before:bg-gradient-to-r before:from-transparent before:via-[var(--neon-bull)] before:to-transparent'
          : 'before:bg-gradient-to-r before:from-transparent before:via-[var(--neon-bear)] before:to-transparent'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
          '[&_svg]:w-8 [&_svg]:h-8 [&_svg]:flex-shrink-0',
          isBullish
            ? 'bg-[var(--neon-bull-dim)] shadow-[0_0_30px_var(--neon-bull-dim)] [&_svg]:text-[var(--neon-bull)]'
            : 'bg-[var(--neon-bear-dim)] shadow-[0_0_30px_var(--neon-bear-dim)] [&_svg]:text-[var(--neon-bear)]'
        )}
      >
        <Icon />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold mb-2">{title}</h3>

      {/* Value */}
      <p
        className={cn(
          'font-mono text-[32px] font-bold',
          isBullish ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]'
        )}
      >
        {value}
      </p>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-[var(--bg-elevated)] p-3 rounded-md">
          <div className="text-[11px] text-[var(--text-muted)] uppercase mb-1">Current RSI</div>
          <div className={cn('font-mono text-sm font-medium', isBullish && 'text-[var(--neon-bull)]')}>
            {currentRsi}
          </div>
        </div>
        <div className="bg-[var(--bg-elevated)] p-3 rounded-md">
          <div className="text-[11px] text-[var(--text-muted)] uppercase mb-1">Confidence</div>
          <div className="font-mono text-sm font-medium">{confidence}%</div>
        </div>
        <div className="bg-[var(--bg-elevated)] p-3 rounded-md">
          <div className="text-[11px] text-[var(--text-muted)] uppercase mb-1">Divergence Type</div>
          <div className={cn('font-mono text-sm font-medium', divergenceType === 'N/A' && 'text-[var(--text-muted)]')}>
            {divergenceType}
          </div>
        </div>
        <div className="bg-[var(--bg-elevated)] p-3 rounded-md">
          <div className="text-[11px] text-[var(--text-muted)] uppercase mb-1">Strength</div>
          <div
            className={cn(
              'font-mono text-sm font-medium',
              strength === 'High' ? (isBullish ? 'text-[var(--neon-bull)]' : 'text-[var(--neon-bear)]') : 'text-[var(--text-muted)]'
            )}
          >
            {strength}
          </div>
        </div>
      </div>
    </div>
  )
}
