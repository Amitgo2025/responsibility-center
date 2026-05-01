import { useEffect, useState } from 'react'
import { createResponsibility, updateResponsibility, listTagCategories, listTags } from '../lib/db'
import TagPicker from './TagPicker'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Under Review' },
  { value: 'transitioning', label: 'Transitioning' },
]

export default function ResponsibilityEditor({
  mode, // 'create' | 'edit'
  responsibility, // existing data when mode === 'edit'
  defaultPersonId,
  defaultSection,
  tabs,
  currentUser,
  onClose,
  onSaved,
}) {
  const isCreate = mode === 'create'
  const [personId, setPersonId] = useState(responsibility?.personId || defaultPersonId || '')
  const [section, setSection] = useState(responsibility?.section || defaultSection || 'media')
  const [title, setTitle] = useState(responsibility?.title || '')
  const [description, setDescription] = useState(responsibility?.description || '')
  const [status, setStatus] = useState(responsibility?.status || 'active')
  const [tagIds, setTagIds] = useState(responsibility?.tags || [])
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('A title is required.')
      return
    }
    if (!personId) {
      setError('Pick a person.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (isCreate) {
        const created = await createResponsibility(
          {
            personId,
            section,
            title: title.trim(),
            description: description.trim(),
            status,
            tags: tagIds,
          },
          currentUser,
        )
        onSaved?.(created)
      } else {
        await updateResponsibility(responsibility.id, {
          personId,
          section,
          title: title.trim(),
          description: description.trim(),
          status,
          tags: tagIds,
        })
        onSaved?.({ ...responsibility, personId, section, title, description, status, tags: tagIds })
      }
      onClose()
    } catch (err) {
      setError(`Save failed: ${err.message}`)
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
          <h2 className="font-display text-2xl text-ink-900">
            {isCreate ? 'New responsibility' : 'Edit responsibility'}
          </h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
                Person
              </label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">— pick a person —</option>
                {tabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
                Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="media">Media Buying Tasks</option>
                <option value="other">Other Responsibilities</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="e.g. 'Ensure Google reports are accurate'"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Description / context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Partners, frequency, what is included, what is not…"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Tags
            </label>
            <TagPicker
              allTags={allTags}
              allCategories={allCategories}
              selectedIds={tagIds}
              onChange={setTagIds}
            />
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
            disabled={submitting || !title.trim() || !personId}
            className="px-4 py-2 bg-ink-900 text-ink-50 rounded text-sm hover:bg-ink-800 disabled:opacity-40 transition"
          >
            {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
