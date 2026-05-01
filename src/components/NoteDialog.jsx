import { useEffect, useState } from 'react'
import { createNote, listTagCategories, listTags } from '../lib/db'
import TagPicker from './TagPicker'

const MAX_FILE_SIZE = 700 * 1024 // 700KB per file (kept in Firestore as base64)
const MAX_TOTAL_SIZE = 900 * 1024 // safety budget for one Firestore doc

export default function NoteDialog({ responsibility, person, currentUser, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagIds, setTagIds] = useState([])
  const [attachments, setAttachments] = useState([]) // [{ name, dataUrl, type, size }]
  const [allTags, setAllTags] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [t, c] = await Promise.all([listTags(), listTagCategories()])
        if (!active) return
        setAllTags(t)
        setAllCategories(c)
      } catch (err) {
        if (active) setError(err.message)
      }
    })()
    return () => { active = false }
  }, [])

  // Allow paste from clipboard
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) addFile(file)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments])

  function addFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      setError(`File "${file.name}" is too large (max ${Math.round(MAX_FILE_SIZE / 1024)}KB).`)
      return
    }
    const totalSize = attachments.reduce((s, a) => s + (a.size || 0), 0)
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      setError('Total attachment size would exceed limit. Remove some files first.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachments((prev) => [
        ...prev,
        {
          name: file.name || `screenshot-${Date.now()}.png`,
          dataUrl: reader.result,
          type: file.type,
          size: file.size,
        },
      ])
      setError('')
    }
    reader.readAsDataURL(file)
  }

  function handleFileInput(e) {
    const files = Array.from(e.target.files || [])
    files.forEach(addFile)
    e.target.value = ''
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Add a short title for the note.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const note = await createNote(
        {
          responsibilityId: responsibility.id,
          personId: responsibility.personId,
          title: title.trim(),
          body: body.trim(),
          tags: tagIds,
          attachments,
        },
        currentUser,
      )
      onCreated?.(note)
      onClose()
    } catch (err) {
      setError(`Could not save: ${err.message}`)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-ink-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-400">
              New note · routed to Amit
            </div>
            <h2 className="font-display text-2xl text-ink-900 leading-tight">
              {responsibility.title}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {person?.name || responsibility.personId}'s responsibility
            </p>
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

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Short summary — e.g. 'Suggestion to change reporting cadence'"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Details (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Context, what you want to change, why…"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Tags (optional)
            </label>
            <TagPicker
              allTags={allTags}
              allCategories={allCategories}
              selectedIds={tagIds}
              onChange={setTagIds}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Attachments — paste screenshot (Ctrl+V) or upload
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileInput}
                className="block w-full text-sm text-ink-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200"
              />
              {attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((a, i) => (
                    <div
                      key={i}
                      className="relative border border-ink-200 rounded overflow-hidden bg-white group"
                    >
                      {a.type.startsWith('image/') ? (
                        <img src={a.dataUrl} alt={a.name} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center text-ink-400 text-xs">
                          {a.name}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-ink-900/80 text-white text-[10px] px-2 py-1 truncate">
                        {a.name} · {Math.round(a.size / 1024)}KB
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-ink-900/80 hover:bg-red-600 text-white rounded-full text-xs"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-ink-400">
                Max ~700KB per file. Each note caps around 900KB total. For bigger files, link from
                Drive or Slack instead.
              </p>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-ink-200 flex items-center justify-end gap-2 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-ink-100 text-ink-700 rounded text-sm hover:bg-ink-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded text-sm disabled:opacity-40 transition"
          >
            {submitting ? 'Sending…' : 'Send to Amit'}
          </button>
        </div>
      </div>
    </div>
  )
}
