import './Chip.css'

interface ChipProps {
  children: string
  active?: boolean
  onClick?: () => void
}

export function Chip({ children, active = false, onClick }: ChipProps) {
  return (
    <span
      className={`chip ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {children}
    </span>
  )
}
