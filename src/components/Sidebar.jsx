import { useNavigate, useLocation } from 'react-router-dom'

export default function Sidebar({ tabs, role, displayName, openNotesCount, unreadChatCount, onLogout, onAdminPanel }) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  function isActive(p) {
    if (p === '/all') return path === '/all' || path.startsWith('/all')
    if (p === '/notes') return path === '/notes' || path.startsWith('/notes')
    if (p === '/schedule') return path === '/schedule' || path.startsWith('/schedule')
    if (p === '/history') return path === '/history' || path.startsWith('/history')
    if (p === '/chat') return path === '/chat' || path.startsWith('/chat')
    return path === p
  }

  function activeTabId() {
    const m = path.match(/^\/tab\/([^/]+)/)
    return m ? m[1] : null
  }
  const tabId = activeTabId()

  return (
    <aside className="w-72 bg-ink-900 text-ink-100 flex flex-col h-screen sticky top-0">
      <div className="px-6 pt-8 pb-6 border-b border-ink-700">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M9 8h14M9 16h10M9 24h14" stroke="#e08a5a" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-display text-xl text-ink-50 leading-none">Responsibility Center</h1>
        </div>
        <p className="text-xs text-ink-300 mt-2 leading-relaxed">
          Open environment. Shared responsibility. Each task has clear owners.
        </p>
      </div>

      {/* Top-level views */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 text-[10px] uppercase tracking-widest text-ink-400 font-medium">
          Views
        </div>
        <ul className="space-y-0.5 px-2 mb-4">
          <li>
            <button
              onClick={() => navigate('/all')}
              className={`w-full text-left px-4 py-2.5 rounded-md transition flex items-center gap-3 ${
                isActive('/all')
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-sm font-medium">All Responsibilities</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate('/notes')}
              className={`w-full text-left px-4 py-2.5 rounded-md transition flex items-center gap-3 ${
                isActive('/notes')
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm font-medium">Notes & Requests</span>
              {openNotesCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-accent text-white text-[10px] rounded-full font-bold">
                  {openNotesCount}
                </span>
              )}
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate('/schedule')}
              className={`w-full text-left px-4 py-2.5 rounded-md transition flex items-center gap-3 ${
                isActive('/schedule')
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-sm font-medium">Schedule</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate('/history')}
              className={`w-full text-left px-4 py-2.5 rounded-md transition flex items-center gap-3 ${
                isActive('/history')
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <polyline points="3 3 3 8 8 8" />
                <polyline points="12 7 12 12 16 14" />
              </svg>
              <span className="text-sm font-medium">History</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate('/chat')}
              className={`w-full text-left px-4 py-2.5 rounded-md transition flex items-center gap-3 ${
                isActive('/chat')
                  ? 'bg-ink-700 text-ink-50'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="text-sm font-medium">Chat</span>
              {unreadChatCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-accent text-white text-[10px] rounded-full font-bold">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </li>
        </ul>

        <div className="px-4 mb-2 text-[10px] uppercase tracking-widest text-ink-400 font-medium">
          People
        </div>
        <ul className="space-y-0.5 px-2">
          {tabs.map((tab) => {
            const active = tab.id === tabId
            return (
              <li key={tab.id}>
                <button
                  onClick={() => navigate(`/tab/${tab.id}`)}
                  className={`w-full text-left px-4 py-3 rounded-md transition group ${
                    active
                      ? 'bg-ink-700 text-ink-50'
                      : 'text-ink-200 hover:bg-ink-800 hover:text-ink-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-1.5 h-6 rounded-full flex-shrink-0"
                      style={{ background: tab.color || '#c46a3a' }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tab.name}</div>
                      <div className="text-[11px] text-ink-400 truncate">{tab.role}</div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-ink-700 space-y-1">
        {role === 'admin' && (
          <button
            onClick={onAdminPanel}
            className="w-full text-left px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 rounded transition flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Admin settings
          </button>
        )}
        <div className="px-3 py-1 text-[11px] text-ink-400">
          {displayName && <span className="text-ink-200">{displayName} · </span>}
          <span className="font-mono uppercase">{role}</span>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 rounded transition flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
