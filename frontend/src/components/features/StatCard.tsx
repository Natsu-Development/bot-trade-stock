import { type SVGProps } from 'react'
import { Icons } from '../icons/Icons'
import type { StatCard as StatCardType } from '../../types'
import './StatCard.css'

interface StatCardProps extends StatCardType {
  icon?: (props: SVGProps<SVGSVGElement>) => JSX.Element
}

export function StatCard({ label, value, change, variant = 'default', icon = Icons.Database }: StatCardProps) {
  const IconComponent = icon

  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-icon">
        <IconComponent />
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {change && (
        <span className={`stat-change ${change.startsWith('+') || change.startsWith('↑') ? 'positive' : 'negative'}`}>
          {change}
        </span>
      )}
    </div>
  )
}
