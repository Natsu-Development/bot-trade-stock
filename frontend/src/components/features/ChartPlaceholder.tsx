import { Icons } from '../icons/Icons'
import './ChartPlaceholder.css'

interface ChartPlaceholderProps {
  symbol?: string
}

export function ChartPlaceholder({ symbol = '' }: ChartPlaceholderProps) {
  return (
    <div className="chart-placeholder">
      <Icons.Chart />
      <span>Interactive chart with TradingView integration{symbol && ` — ${symbol}`}</span>
    </div>
  )
}
