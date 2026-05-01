import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import Sidebar from './components/Sidebar'
import TabView from './components/TabView'
import AdminPanel from './components/AdminPanel'
import { getSession, logout } from './lib/auth'
import { listTabs } from './lib/db'

function ProtectedShell() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getSession())
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdmin, setShowAdmin] = useState(false)
  const [error, setError] = useState('')

  const refreshTabs = useCallback(async () => {
    try {
      const list = await listTabs()
      setTabs(list)
      setError('')
    } catch (err) {
      setError(`Could not load tabs: ${err.message}`)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    let active = true
    ;(async () => {
      await refreshTabs()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [session, navigate, refreshTabs])

  function handleLogout() {
    logout()
    setSession(null)
    navigate('/login', { replace: true })
  }

  if (!session) return null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-8">
        <div className="max-w-md text-center">
          <p className="text-ink-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-ink-900 text-ink-50 rounded-md text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (tabs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-8">
        <div className="max-w-md text-center">
          <h2 className="font-display text-3xl text-ink-900 mb-3">No tabs yet</h2>
          <p className="text-ink-500 mb-6">
            {session.role === 'admin'
              ? 'Open admin settings to create your first tab.'
              : 'Ask your admin to set up the system.'}
          </p>
          {session.role === 'admin' && (
            <button
              onClick={() => setShowAdmin(true)}
              className="px-4 py-2 bg-ink-900 text-ink-50 rounded-md text-sm"
            >
              Open admin settings
            </button>
          )}
          <button
            onClick={handleLogout}
            className="ml-2 px-4 py-2 bg-ink-100 text-ink-700 rounded-md text-sm"
          >
            Sign out
          </button>
        </div>
        {showAdmin && (
          <AdminPanel
            tabs={tabs}
            onClose={() => setShowAdmin(false)}
            onTabsChanged={refreshTabs}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex bg-paper min-h-screen">
      <Sidebar
        tabs={tabs}
        role={session.role}
        onLogout={handleLogout}
        onAdminPanel={() => setShowAdmin(true)}
      />
      <Routes>
        <Route path="/" element={<Navigate to={`/tab/${tabs[0].id}`} replace />} />
        <Route path="/tab/:tabId" element={<TabView role={session.role} />} />
        <Route path="*" element={<Navigate to={`/tab/${tabs[0].id}`} replace />} />
      </Routes>
      {showAdmin && (
        <AdminPanel
          tabs={tabs}
          onClose={() => setShowAdmin(false)}
          onTabsChanged={refreshTabs}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  )
}
