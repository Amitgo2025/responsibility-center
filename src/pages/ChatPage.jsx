import { useEffect, useRef, useState } from 'react'
import {
  listChatMessages,
  sendChatMessage,
  deleteChatMessage,
  formatIsraelTime,
} from '../lib/db'

const LAST_SEEN_KEY = 'rc_chat_last_seen'

export default function ChatPage({ role, currentUser }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const isAdmin = role === 'admin'

  async function refresh() {
    try {
      const m = await listChatMessages()
      setMessages(m)
      // Mark all as seen
      if (m.length > 0) {
        try {
          localStorage.setItem(LAST_SEEN_KEY, m[m.length - 1].createdAt)
        } catch {}
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [])

  // Poll every 15s for new messages
  useEffect(() => {
    const id = setInterval(() => {
      refresh()
    }, 15 * 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend() {
    if (!draft.trim()) return
    setSending(true)
    setError('')
    try {
      const author = currentUser?.displayName || (isAdmin ? 'Amit (admin)' : 'anonymous')
      await sendChatMessage(draft, author, role)
      setDraft('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(msgId) {
    if (!confirm('Delete this message?')) return
    try {
      await deleteChatMessage(msgId)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
  const groups = []
  let currentDate = ''
  for (const m of messages) {
    const d = (m.createdAt || '').slice(0, 10)
    if (d !== currentDate) {
      currentDate = d
      groups.push({ date: d, items: [] })
    }
    groups[groups.length - 1].items.push(m)
  }

  return (
    <main className="flex-1 bg-paper min-h-screen flex flex-col">
      <header className="border-b border-ink-200 bg-white flex-shrink-0">
        <div className="px-10 py-6 max-w-4xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-1">
            Team chat
          </div>
          <h1 className="font-display text-3xl text-ink-900">Group conversation</h1>
          <p className="text-ink-500 text-sm mt-1">
            Quick recommendations, heads-up, anything the team should know — drop it here.
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-10 pt-4 pb-4 overflow-hidden">
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-white border border-ink-200 rounded-lg p-4 mb-3"
        >
          {loading ? (
            <p className="text-ink-400 text-sm">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-ink-400 text-sm italic">
                No messages yet. Start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-px bg-ink-100" />
                    <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
                      {formatHumanDate(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-ink-100" />
                  </div>
                  <div className="space-y-2">
                    {group.items.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMine={msg.author === currentUser?.displayName}
                        isAdmin={isAdmin}
                        onDelete={() => handleDelete(msg.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-ink-200 rounded-lg p-2 flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            className="flex-1 px-3 py-2 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="px-4 py-2 bg-ink-900 hover:bg-ink-800 text-ink-50 text-sm rounded transition disabled:opacity-40 self-stretch"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </main>
  )
}

function MessageBubble({ msg, isMine, isAdmin, onDelete }) {
  const time = formatIsraelTime(msg.createdAt).split(', ').slice(-1)[0] || ''
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%] group">
        <div
          className={`rounded-lg px-3 py-2 ${
            isMine
              ? 'bg-accent text-white'
              : 'bg-ink-50 border border-ink-100 text-ink-900'
          }`}
        >
          {!isMine && (
            <div className="text-[11px] font-medium mb-0.5 text-ink-600">
              {msg.author}
              {msg.authorRole === 'admin' && (
                <span className="ml-1 text-[9px] opacity-70 font-mono">ADMIN</span>
              )}
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{msg.text}</p>
        </div>
        <div className={`text-[10px] text-ink-400 mt-0.5 px-1 ${isMine ? 'text-right' : ''}`}>
          {time}
          {isAdmin && (
            <button
              onClick={onDelete}
              className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition"
            >
              delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatHumanDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yest = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yest) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Helper for sidebar — checks if there are messages newer than the user's last visit
export async function getUnreadChatCount() {
  try {
    const messages = await listChatMessages()
    let lastSeen = ''
    try {
      lastSeen = localStorage.getItem(LAST_SEEN_KEY) || ''
    } catch {}
    if (!lastSeen) return messages.length
    return messages.filter((m) => (m.createdAt || '') > lastSeen).length
  } catch {
    return 0
  }
}
