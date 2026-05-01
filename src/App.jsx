import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { getSession, logout } from './lib/auth'
import { listTabs, listAllNotes } from './lib/db'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import AllResponsibilitiesPage from './pages/AllResponsibilitiesPage'
import NotesPage from './pages/NotesPage'
import SchedulePage from './pages/SchedulePage'
import ScheduleHistoryPage from './pages/ScheduleHistoryPage'
import ChatPage, { getUnreadChatCount } from './pages/ChatPage'
import Sidebar from './components/Sidebar'
import TabView from './components/TabView'
import AdminPanel from './components/AdminPanel'

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  )
}

function ProtectedShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(undefined) // undefined = checking, null = signed out
  const [tabs, setTabs] = useState([])
  const [openNotesCount, setOpenNotesCount] = useState(0)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [error, setError] = useState('')

  // Check session on mount and on path changes
  useEffect(() => {
    const s = getSession()
    setSession(s)
    if (!s) {
      navigate('/login', { replace: true })
    }
  }, [navigate, location.pathname])

  const refreshSidebar = useCallback(async () => {
    try {
      const [t, notes, unread] = await Promise.all([
        listTabs(),
        listAllNotes(),
        getUnreadChatCount(),
      ])
      setTabs(t)
      setOpenNotesCount(notes.filter((n) => n.status === 'open').length)
      setUnreadChatCount(unread)
      setError('')
    } catch (err) {
      setError(`Could not load: ${err.message}`)
    }
  }, [])

  useEffect(() => {
    if (session) refreshSidebar()
  }, [session, refreshSidebar, location.pathname])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </div>
    )
  }
  if (!session) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar
        tabs={tabs}
        role={session.role}
        displayName={session.displayName}
        openNotesCount={openNotesCount}
        unreadChatCount={unreadChatCount}
        onLogout={handleLogout}
        onAdminPanel={() => setShowAdminPanel(true)}
      />
      <div className="flex-1 min-w-0">
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/all" replace />} />
          <Route
            path="/all"
            element={<AllResponsibilitiesPage role={session.role} currentUser={session} />}
          />
          <Route path="/notes" element={<NotesPage role={session.role} />} />
          <Route path="/schedule" element={<SchedulePage role={session.role} />} />
          <Route path="/history" element={<ScheduleHistoryPage role={session.role} />} />
          <Route
            path="/chat"
            element={<ChatPage role={session.role} currentUser={session} />}
          />
          <Route
            path="/tab/:tabId"
            element={
              <TabView
                role={session.role}
                currentUser={session}
                tabs={tabs}
                onTabsChanged={refreshSidebar}
              />
            }
          />
          <Route path="*" element={<Navigate to="/all" replace />} />
        </Routes>
      </div>
      {showAdminPanel && session.role === 'admin' && (
        <AdminPanel
          tabs={tabs}
          onClose={() => setShowAdminPanel(false)}
          onTabsChanged={refreshSidebar}
        />
      )}
    </div>
  )
}
