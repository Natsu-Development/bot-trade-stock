import { ReactNode } from 'react'
import { Icons } from '../icons/Icons'
import type { ButtonVariant } from '../../types'
import './Button.css'

interface ButtonProps {
  children: ReactNode
  variant?: ButtonVariant
  icon?: keyof typeof Icons
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Button({ children, variant = 'secondary', icon, onClick, className = '', style, disabled = false, type = 'button' }: ButtonProps) {
  const IconComponent = icon ? Icons[icon] : null

  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      style={style}
      disabled={disabled}
    >
      {IconComponent && <IconComponent />}
      {children}
    </button>
  )
}
