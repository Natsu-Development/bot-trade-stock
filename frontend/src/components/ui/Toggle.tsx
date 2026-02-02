import { useState } from 'react'
import './Toggle.css'

interface ToggleProps {
  active?: boolean
  onChange?: (active: boolean) => void
}

export function Toggle({ active = false, onChange }: ToggleProps) {
  const [isActive, setIsActive] = useState(active)

  const handleClick = () => {
    const newState = !isActive
    setIsActive(newState)
    onChange?.(newState)
  }

  return (
    <div className={`toggle ${isActive ? 'active' : ''}`} onClick={handleClick} />
  )
}
