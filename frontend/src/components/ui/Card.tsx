import { ReactNode } from 'react'
import './Card.css'

interface CardProps {
  children: ReactNode
  className?: string
}

interface CardHeaderProps {
  children: ReactNode
  action?: ReactNode
}

interface CardBodyProps {
  children: ReactNode
  style?: React.CSSProperties
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`card ${className}`}>{children}</div>
}

Card.Header = function CardHeader({ children, action }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div className="card-title">{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

Card.Body = function CardBody({ children, style }: CardBodyProps) {
  return <div className="card-body" style={style}>{children}</div>
}
