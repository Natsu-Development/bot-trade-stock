import { memo } from 'react'
import { cn } from '@/lib/utils'
import { isSignalConfirmed, type ApiTradingSignal } from '@/lib/api'
import { deriveSignalTargets } from '@/lib/signalTargets'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

interface SignalsTableProps {
  /** Already chip-filtered trendline signals (breakout/breakdown × confirmed/potential). */
  signals: ApiTradingSignal[]
}

function signalLabel(type: string): string {
  return type.includes('breakout') ? 'Breakout' : 'Breakdown'
}

/** Trim a date/datetime string to its YYYY-MM-DD portion. */
function shortDate(time: string): string {
  return time.length >= 10 ? time.slice(0, 10) : time
}

const price = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })
/** Optional price field (target / stop): em-dash when unset or non-positive. */
const optPrice = (v: number | undefined) => (v != null && v > 0 ? price(v) : '—')

/**
 * Tabular view of the analyze signals (the same set drawn as chart markers).
 * The caller passes the already chip-filtered signals so the table and the
 * chart markers stay in lock-step.
 */
export const SignalsTable = memo(function SignalsTable({ signals }: SignalsTableProps) {
  if (signals.length === 0) {
    return (
      <div
        data-testid="analyze-signals-table"
        className="rounded-lg border border-dashed border-[var(--border-dim)] bg-[var(--bg-elevated)] px-3 py-3.5 text-center text-xs text-[var(--text-muted)]"
      >
        No signals match this filter.
      </div>
    )
  }

  const ordered = [...signals].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))

  return (
    <div
      data-testid="analyze-signals-table"
      className="overflow-hidden rounded-lg border border-[var(--border-dim)]"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Signal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="text-right">Stop</TableHead>
            <TableHead className="text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((sig, i) => {
            const isUp = sig.type.includes('breakout')
            const confirmed = isSignalConfirmed(sig)
            // Target = the trendline's projected price (price_line); Stop = its mirror
            // around the entry price. Backend leaves sig.target/stop_loss unset.
            const { target, stop } = deriveSignalTargets(sig)
            // Key off content + row index: the backend never sets sig.id, and two signals
            // can share type+time (e.g. two breakdown_confirmed on one day), so an id- or
            // type+time-only key collides. The index keeps it unique for this display-only table.
            return (
              <TableRow
                key={`${sig.type}-${sig.time}-${sig.price}-${i}`}
                data-testid={`signal-row-${i}`}
              >
                <TableCell className="font-sans font-semibold">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-md text-[11px] font-extrabold',
                        isUp
                          ? 'bg-[var(--neon-bull-dim)] text-[var(--neon-bull)]'
                          : 'bg-[var(--neon-bear-dim)] text-[var(--neon-bear)]'
                      )}
                    >
                      {isUp ? '▲' : '▼'}
                    </span>
                    {signalLabel(sig.type)}
                  </span>
                </TableCell>
                <TableCell className="font-sans">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                      confirmed
                        ? 'bg-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]'
                        : 'bg-[var(--neon-amber-dim)] text-[var(--neon-amber)]'
                    )}
                  >
                    {confirmed ? 'Confirmed' : 'Potential'}
                  </span>
                </TableCell>
                <TableCell className="text-right">{price(sig.price)}</TableCell>
                <TableCell className="text-right text-[var(--neon-bull)]">
                  {optPrice(target)}
                </TableCell>
                <TableCell className="text-right text-[var(--neon-bear)]">
                  {optPrice(stop)}
                </TableCell>
                <TableCell className="text-right text-[var(--text-muted)]">
                  {shortDate(sig.time)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
})
