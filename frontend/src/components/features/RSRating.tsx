import { getRsLevel, cn } from '../../lib/utils'
import type { RSLevel } from '../../types'
import './RSRating.css'

interface RSRatingProps {
  value: number
  showBar?: boolean
  className?: string
}

export function RSRating({ value, showBar = true, className = '' }: RSRatingProps) {
  const level = getRsLevel(value) as RSLevel

  return (
    <div className={cn('rs-rating', className)}>
      {showBar && (
        <div className="rs-bar">
          <div
            className={`rs-fill ${level}`}
            style={{ width: `${value}%` }}
          />
        </div>
      )}
      <span className={`rs-value ${level}`}>{value}</span>
    </div>
  )
}
