import { useEffect, useState } from 'react'
import {
  listPinnedNotices,
  createPinnedNotice,
  updatePinnedNotice,
  deletePinnedNotice,
  formatIsraelTime,
} from '../lib/db'

export default function PinnedNoticesBoard({ role, currentUser }) {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const isAdmin = role === 'admin'

  async function refresh() {
    try {
      const list = await listPinnedNotices()
      setNotices(list)
      setError('')
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

  if (loading) return null

  // Viewers only see existing notices, never the "Add" button
  if (!isAdmin && notices.length === 0) return null

  return (
    <div className="space-y-2">
      {notices.map((n) => (
        editingId === n.id ? (
          <NoticeEditor
            key={n.id}
            notice={n}
            currentUser={currentUser}
            onCancel={() => setEditingId(null)}
            onSaved={async () => {
              setEditingId(null)
              await refresh()
            }}
          />
        ) : (
          <NoticeCard
            key={n.id}
            notice={n}
            isAdmin={isAdmin}
            onEdit={() => setEditingId(n.id)}
            onDelete={async () => {
              if (!confirm(`Delete the pinned notice "${n.title || 'untitled'}"?`)) return
              try {
                await deletePinnedNotice(n.id)
                await refresh()
              } catch (err) {
                setError(err.message)
              }
            }}
          />
        )
      ))}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {isAdmin && (
        composing ? (
          <NoticeEditor
            currentUser={currentUser}
            onCancel={() => setComposing(false)}
            onSaved={async () => {
              setComposing(false)
              await refresh()
            }}
          />
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="text-xs text-ink-500 hover:text-ink-900 underline px-2 py-1"
          >
            + Pin a notice
          </button>
        )
      )}
    </div>
  )
}

function NoticeCard({ notice, isAdmin, onEdit, onDelete }) {
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            {notice.title ? (
              <h3 className="font-display text-lg text-ink-900 leading-none">{notice.title}</h3>
            ) : (
              <h3 className="font-display text-lg text-ink-700 italic leading-none">Pinned</h3>
            )}
            <span className="text-[11px] text-ink-500">
              {notice.author && <>by <span className="text-ink-700">{notice.author}</span> · </>}
              {notice.updatedAt && formatIsraelTime(notice.updatedAt)}
            </span>
          </div>
          {notice.body && (
            <p className="mt-1.5 text-sm text-ink-800 leading-relaxed whitespace-pre-wrap break-words">
              {notice.body}
            </p>
          )}
          {notice.url && (
            <a
              href={notice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:text-accent-dark font-medium underline break-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {prettyUrl(notice.url)}
            </a>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="text-xs text-ink-600 hover:text-ink-900 underline"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NoticeEditor({ notice, currentUser, onCancel, onSaved }) {
  const isCreate = !notice
  const [title, setTitle] = useState(notice?.title || '')
  const [body, setBody] = useState(notice?.body || '')
  const [url, setUrl] = useState(notice?.url || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!body.trim() && !title.trim() && !url.trim()) {
      setError('Add at least a title, body, or link.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isCreate) {
        await createPinnedNotice({
          title,
          body,
          url,
          author: currentUser?.displayName || 'admin',
        })
      } else {
        await updatePinnedNotice(notice.id, { title, body, url })
      }
      onSaved?.()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="font-display text-lg text-ink-900">
          {isCreate ? 'Pin a notice' : 'Edit pinned notice'}
        </h3>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Notice text — what should the team know?"
          className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link URL (optional) — e.g. https://drive.google.com/…"
          className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
        />
      </div>

      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={submitting}
          className="px-3 py-1.5 bg-ink-900 hover:bg-ink-800 text-ink-50 text-sm rounded disabled:opacity-40"
        >
          {submitting ? 'Saving…' : isCreate ? 'Pin notice' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 bg-white border border-ink-200 text-ink-700 text-sm rounded hover:bg-ink-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function prettyUrl(url) {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}
