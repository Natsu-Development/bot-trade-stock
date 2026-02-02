import { ReactNode } from 'react'
import './SettingsItem.css'

interface SettingsItemProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function SettingsItem({ icon, title, description, action }: SettingsItemProps) {
  return (
    <div className="settings-item">
      <div className="settings-item-left">
        <div className="settings-item-icon">{icon}</div>
        <div>
          <div className="settings-item-title">{title}</div>
          <div className="settings-item-desc">{description}</div>
        </div>
      </div>
      {action}
    </div>
  )
}
