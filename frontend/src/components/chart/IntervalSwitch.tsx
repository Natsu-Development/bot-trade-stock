import { memo } from 'react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { IntervalControl, IntervalOption } from './intervalOptions'

// Re-export the shared types so existing call sites (PriceChart, ChartControls)
// keep importing them from here. The option list + types live in ./intervalOptions
// (a component-free module) — see CHART_INTERVAL_OPTIONS there.
export type { IntervalControl, IntervalOption } from './intervalOptions'

interface IntervalSwitchProps extends IntervalControl {
  className?: string
}

/**
 * Chart interval (timeframe) selector — a compact dropdown (themed Radix Select).
 * Selecting an interval refetches the symbol analysis at that cadence. On the
 * screener it replaces the scroll & scale (navigation + zoom) controls.
 *
 * (Keeps the historical `IntervalSwitch` name + `chart-interval-switch` testid so
 * the existing call sites and e2e selectors stay stable; it is now a dropdown
 * rather than a segmented switch because the supported interval set has 9 entries.)
 */
export const IntervalSwitch = memo(function IntervalSwitch({
  value,
  options,
  onChange,
  className,
}: IntervalSwitchProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Chart interval"
        data-testid="chart-interval-switch"
        className={cn('h-7 w-[4.75rem] px-2.5 py-1 text-xs font-medium', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt: IntervalOption) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            data-testid={`interval-option-${opt.value}`}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})
