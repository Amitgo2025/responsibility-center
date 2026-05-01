import { useEffect, useState } from 'react'
import {
  listNotesForResponsibility,
  updateNoteStatus,
  deleteNote,
  listTags,
  listTagCategories,
} from '../lib/db'
import TagChip from './TagChip'

export default function NotesViewer({ responsibility, isAdmin, onClose, onChanged }) {
  const [notes, setNotes] = useState([])
  const [allTags, setAllTags] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [n, t, c] = await Promise.all([
        listNotesForResponsibility(responsibility.id),
        listTags(),
        listTagCategories(),
      ])
      setNotes(n)
      setAllTags(t)
      setAllCategories(c)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsibility.id])

  async function toggleStatus(note) {
    const newStatus = note.status === 'open' ? 'closed' : 'open'
    try {
      await updateNoteStatus(note.id, newStatus)
      await refresh()
      onChanged?.()
    } catch (err) {
      alert(`Could not update: ${err.message}`)
    }
  }

  async function handleDelete(note) {
    if (!confirm('Delete this note? This cannot be undone.')) return
    try {
      await deleteNote(note.id)
      await refresh()
      onChanged?.()
    } catch (err) {
      alert(`Could not delete: ${err.message}`)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-ink-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-400">
              Notes for
            </div>
            <h2 className="font-display text-2xl text-ink-900 leading-tight">
              {responsibility.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-900 transition"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-3 flex-1">
          {loading && <p className="text-ink-400 text-sm">Loading…</p>}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          {!loading && notes.length === 0 && (
            <p className="text-ink-400 text-sm italic">No notes on this responsibility yet.</p>
          )}
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              allTags={allTags}
              allCategories={allCategories}
              isAdmin={isAdmin}
              onToggleStatus={() => toggleStatus(note)}
              onDelete={() => handleDelete(note)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function NoteCard({ note, allTags, allCategories, isAdmin, onToggleStatus, onDelete, showResponsibilityHint }) {
  const tags = (note.tags || []).map((id) => allTags.find((t) => t.id === id)).filter(Boolean)
  const isOpen = note.status === 'open'

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        isOpen ? 'border-accent/40 bg-accent/5' : 'border-ink-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-ink-900">{note.title}</h4>
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                isOpen
                  ? 'bg-accent/15 text-accent border-accent/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {note.status}
            </span>
          </div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            {note.author || 'anonymous'} ·{' '}
            {note.createdAt ? new Date(note.createdAt).toLocaleString() : '—'}
            {showResponsibilityHint && note._respTitle && (
              <span> · re: <span className="text-ink-600">{note._respTitle}</span></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAdmin && (
            <>
              <button
                onClick={onToggleStatus}
                className="px-2.5 py-1 text-xs bg-ink-100 hover:bg-ink-200 text-ink-700 rounded transition"
              >
                Mark {isOpen ? 'closed' : 'open'}
              </button>
              <button
                onClick={onDelete}
                className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {note.body && (
        <p className="text-sm text-ink-700 whitespace-pre-wrap mb-3 leading-relaxed">{note.body}</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              category={allCategories.find((c) => c.id === tag.categoryId)}
              size="xs"
            />
          ))}
        </div>
      )}

      {note.attachments && note.attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {note.attachments.map((a, i) => (
            <a
              key={i}
              href={a.dataUrl}
              target="_blank"
              rel="noreferrer"
              className="block border border-ink-200 rounded overflow-hidden bg-ink-50 hover:border-accent transition"
            >
              {a.type?.startsWith('image/') ? (
                <img src={a.dataUrl} alt={a.name} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 flex items-center justify-center text-ink-500 text-xs p-2 text-center">
                  {a.name}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
