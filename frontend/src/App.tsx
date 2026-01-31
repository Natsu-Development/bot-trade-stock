import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Activity, Search, TrendingUp, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { Toast } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Screener } from './pages/Screener';
import { Divergence } from './pages/Divergence';
import { ConfigPage } from './pages/Config';
import { Settings } from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="sidebar-logo">TB</div>

          <a href="/" className="nav-item" title="Dashboard">
            <Activity strokeWidth={2} />
          </a>

          <a href="/screener" className="nav-item" title="Stock Screener">
            <TrendingUp strokeWidth={2} />
          </a>

          <a href="/divergence" className="nav-item" title="Divergence Analysis">
            <Search strokeWidth={2} />
          </a>

          <a href="/config" className="nav-item" title="Configuration">
            <Sliders strokeWidth={2} />
          </a>

          <div className="sidebar-bottom">
            <a href="/settings" className="nav-item" title="Settings">
              <SettingsIcon strokeWidth={2} />
            </a>
          </div>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/divergence" element={<Divergence />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toast />
    </BrowserRouter>
  );
}

export default App;
