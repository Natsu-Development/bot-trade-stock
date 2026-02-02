import { useNavigation } from './hooks/useNavigation'
import { useConfigId } from './hooks/useConfigId'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './components/pages/Dashboard'
import { Screener } from './components/pages/Screener'
import { Divergence } from './components/pages/Divergence'
import { Config } from './components/pages/Config'
import { Settings } from './components/pages/Settings'
import { UsernameDialog } from './components/pages/UsernameDialog'

function App() {
  const { currentPage, navigate } = useNavigation()
  const { configId, isLoading, setConfigId } = useConfigId()

  // Show username dialog if not authenticated and done loading
  const showUsernameDialog = !isLoading && configId === null

  return (
    <>
      {showUsernameDialog && (
        <UsernameDialog isOpen={showUsernameDialog} setConfigId={setConfigId} />
      )}

      <div className={`app${showUsernameDialog ? ' app-blurred' : ''}`}>
        <Sidebar currentPage={currentPage} onNavigate={navigate} />
        <main className="main">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'screener' && <Screener />}
          {currentPage === 'divergence' && <Divergence />}
          {currentPage === 'config' && <Config />}
          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
    </>
  )
}

export default App
