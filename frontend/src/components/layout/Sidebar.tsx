import { Icons } from '../icons/Icons'
import type { Page } from '../../types'
import './Sidebar.css'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems = [
  { id: 'dashboard' as Page, icon: Icons.Dashboard, label: 'Dashboard' },
  { id: 'screener' as Page, icon: Icons.Search, label: 'Screener' },
  { id: 'divergence' as Page, icon: Icons.Chart, label: 'Divergence' },
  { id: 'config' as Page, icon: Icons.Settings, label: 'Config' },
  { id: 'settings' as Page, icon: Icons.Sliders, label: 'Settings' },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="logo">VN</div>

      <nav className="nav-items">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon />
            <span className="tooltip">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item">
          <div className="status-indicator"></div>
          <span className="tooltip">API Connected</span>
        </div>
      </div>
    </aside>
  )
}
