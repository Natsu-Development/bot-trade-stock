import { useNavigation } from './hooks/useNavigation'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './components/pages/Dashboard'
import { Screener } from './components/pages/Screener'
import { Divergence } from './components/pages/Divergence'
import { Config } from './components/pages/Config'
import { Settings } from './components/pages/Settings'

function App() {
  const { currentPage, navigate } = useNavigation()

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} onNavigate={navigate} />
      <main className="main">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'screener' && <Screener />}
        {currentPage === 'divergence' && <Divergence />}
        {currentPage === 'config' && <Config />}
        {currentPage === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default App
