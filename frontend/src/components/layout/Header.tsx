import { ReactNode } from 'react'
import { useClock } from '../../hooks/useClock'
import './Header.css'

interface HeaderProps {
  title: string
  subtitle: string
  actions?: ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const time = useClock()

  return (
    <header className="header">
      <div className="header-left">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-right">
        <div className="time-display">{time}</div>
        {actions}
      </div>
    </header>
  )
}
