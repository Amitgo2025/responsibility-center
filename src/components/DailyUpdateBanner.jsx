import { useEffect, useState } from 'react'
import {
  getTodayUpdate,
  setDailyUpdate,
  clearDailyUpdate,
  todayDateString,
  formatIsraelTime,
} from '../lib/db'

export default function DailyUpdateBanner({ role, currentUser }) {
  const [update, setUpdate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = role === 'admin'
  const today = todayDateString()

  async function refresh() {
    try {
      const u = await getTodayUpdate()
      setUpdate(u)
      setDraft(u?.message || '')
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

  async function handleSave() {
    if (!draft.trim()) {
      setError('Empty message — clear instead.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await setDailyUpdate(today, draft.trim(), currentUser?.displayName || 'admin')
      setEditing(false)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClear() {
    if (!confirm("Clear today's update?")) return
    setSubmitting(true)
    try {
      await clearDailyUpdate(today)
      setEditing(false)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  // No update + viewer → render nothing
  if (!update && !isAdmin) return null

  // No update + admin → show small "post update" prompt
  if (!update && isAdmin && !editing) {
    return (
      <div className="border border-dashed border-ink-200 rounded-lg p-3 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a7165" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <span className="text-sm text-ink-500">No update for today.</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto px-2.5 py-1 text-xs bg-accent hover:bg-accent-dark text-white rounded transition"
        >
          + Post daily update
        </button>
      </div>
    )
  }

  // Editing mode
  if (editing && isAdmin) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="font-display text-lg text-ink-900">Daily update</h3>
          <span className="text-xs text-ink-500 font-mono">· {today}</span>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Share something the whole team needs to know today…"
          className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={submitting || !draft.trim()}
            className="px-3 py-1.5 bg-ink-900 hover:bg-ink-800 text-ink-50 text-sm rounded disabled:opacity-40"
          >
            {submitting ? 'Saving…' : update ? 'Update message' : 'Post'}
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setDraft(update?.message || '')
              setError('')
            }}
            className="px-3 py-1.5 bg-white border border-ink-200 text-ink-700 text-sm rounded hover:bg-ink-50"
          >
            Cancel
          </button>
          {update && (
            <button
              onClick={handleClear}
              disabled={submitting}
              className="ml-auto px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Clear today's update
            </button>
          )}
        </div>
      </div>
    )
  }

  // Display mode (everyone sees)
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-display text-lg text-ink-900 leading-none">Daily update</h3>
            <span className="text-[11px] text-ink-500">
              {update.author && <>by <span className="text-ink-700">{update.author}</span> · </>}
              {update.updatedAt && formatIsraelTime(update.updatedAt)}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
            {update.message}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-ink-500 hover:text-ink-900 underline flex-shrink-0"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
