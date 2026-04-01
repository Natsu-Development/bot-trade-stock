import { lazy, Suspense } from 'react'
import { useNavigation } from './hooks/useNavigation'
import { useConfigId } from './hooks/useConfigId'
import { Sidebar } from './components/layout/Sidebar'
import { UsernameDialog } from './components/pages/UsernameDialog'
import { TooltipProvider } from './components/ui/tooltip'

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./components/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Screener = lazy(() => import('./components/pages/Screener').then(m => ({ default: m.Screener })))
const Divergence = lazy(() => import('./components/pages/Divergence').then(m => ({ default: m.Divergence })))
const Config = lazy(() => import('./components/pages/Config').then(m => ({ default: m.Config })))
const Settings = lazy(() => import('./components/pages/Settings').then(m => ({ default: m.Settings })))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[var(--neon-cyan)] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[var(--text-muted)]">Loading...</span>
      </div>
    </div>
  )
}

function App() {
  const { currentPage, navigate } = useNavigation()
  const { configId, isLoading, setConfigId } = useConfigId()

  // Show username dialog if not authenticated and done loading
  const showUsernameDialog = !isLoading && configId === null

  return (
    <TooltipProvider delayDuration={100}>
      {showUsernameDialog && (
        <UsernameDialog isOpen={showUsernameDialog} setConfigId={setConfigId} />
      )}

      <div className={`app${showUsernameDialog ? ' app-blurred' : ''}`}>
        <Sidebar currentPage={currentPage} onNavigate={navigate} />
        <main className="main">
          <Suspense fallback={<PageLoader />}>
            {currentPage === 'dashboard' && <Dashboard />}
            {currentPage === 'screener' && <Screener />}
            {currentPage === 'divergence' && <Divergence />}
            {currentPage === 'config' && <Config />}
            {currentPage === 'settings' && <Settings />}
          </Suspense>
        </main>
      </div>
    </TooltipProvider>
  )
}

export default App
