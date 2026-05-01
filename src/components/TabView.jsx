import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTab, saveTab, newItemId } from '../lib/db'

const STATUS_LABELS = {
  active: { label: 'Active', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  review: { label: 'Under Review', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  transitioning: { label: 'Transitioning', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
}

export default function TabView({ role }) {
  const { tabId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = role === 'admin'

  useEffect(() => {
    let active = true
    setLoading(true)
    setEditMode(false)
    setError('')
    ;(async () => {
      try {
        const t = await getTab(tabId)
        if (!active) return
        if (!t) {
          setError(`No tab "${tabId}" found.`)
          setLoading(false)
          return
        }
        setTab(t)
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError(`Could not load tab: ${err.message}`)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [tabId])

  function startEditing() {
    setDraft(JSON.parse(JSON.stringify(tab)))
    setEditMode(true)
  }

  function cancelEditing() {
    setDraft(null)
    setEditMode(false)
  }

  async function saveDraft() {
    setSaving(true)
    setError('')
    try {
      const { id, ...payload } = draft
      await saveTab(id, payload)
      setTab(draft)
      setEditMode(false)
      setDraft(null)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2400)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function updateDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function updateItem(itemId, patch) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }))
  }

  function addItem() {
    setDraft((d) => ({
      ...d,
      items: [
        ...(d.items || []),
        { id: newItemId(), title: '', notes: '', status: 'active' },
      ],
    }))
  }

  function removeItem(itemId) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== itemId) }))
  }

  function moveItem(itemId, dir) {
    setDraft((d) => {
      const idx = d.items.findIndex((it) => it.id === itemId)
      if (idx < 0) return d
      const target = idx + dir
      if (target < 0 || target >= d.items.length) return d
      const items = [...d.items]
      const [moved] = items.splice(idx, 1)
      items.splice(target, 0, moved)
      return { ...d, items }
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </div>
    )
  }

  if (error && !tab) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper p-8">
        <div className="text-center">
          <p className="text-ink-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-ink-900 text-ink-50 rounded-md text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const view = editMode ? draft : tab

  return (
    <main className="flex-1 bg-paper min-h-screen">
      {/* Hero header */}
      <header
        className="relative overflow-hidden border-b border-ink-200"
        style={{ background: `linear-gradient(135deg, ${view.color || '#1c1815'} 0%, #1c1815 100%)` }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative px-10 py-12 max-w-5xl">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-ink-200 mb-2">
                Zone
              </div>
              {editMode ? (
                <input
                  value={view.name || ''}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className="font-display text-5xl bg-transparent text-ink-50 border-b border-ink-300/40 focus:outline-none focus:border-ink-50 w-full mb-2"
                />
              ) : (
                <h1 className="font-display text-5xl text-ink-50 leading-none mb-2">{view.name}</h1>
              )}
              {editMode ? (
                <input
                  value={view.role || ''}
                  onChange={(e) => updateDraft({ role: e.target.value })}
                  placeholder="Role description"
                  className="text-ink-100 bg-transparent border-b border-ink-300/40 focus:outline-none focus:border-ink-50 w-full"
                />
              ) : (
                <p className="text-ink-100 italic">{view.role}</p>
              )}
            </div>
            {view.contributionShare != null && (
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] uppercase tracking-widest text-ink-200 mb-1">
                  Contribution
                </div>
                {editMode ? (
                  <input
                    type="number"
                    value={view.contributionShare ?? ''}
                    onChange={(e) =>
                      updateDraft({
                        contributionShare:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="font-display text-4xl tabular bg-transparent text-ink-50 border-b border-ink-300/40 focus:outline-none focus:border-ink-50 w-24 text-right"
                  />
                ) : (
                  <div className="font-display text-5xl tabular text-ink-50 leading-none">
                    {view.contributionShare}<span className="text-2xl text-ink-200">%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Edit controls */}
          {isAdmin && (
            <div className="mt-8 flex items-center gap-2">
              {!editMode ? (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 bg-ink-50/10 hover:bg-ink-50/20 text-ink-50 text-sm rounded backdrop-blur transition flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={saveDraft}
                    disabled={saving}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-3 py-1.5 bg-ink-50/10 hover:bg-ink-50/20 text-ink-50 text-sm rounded backdrop-blur transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              {savedFlash && (
                <span className="text-emerald-300 text-sm tracking-wide">✓ Saved</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="px-10 py-10 max-w-5xl">
        {error && editMode && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xs uppercase tracking-widest text-ink-400 font-medium">
            Responsibilities · {view.items?.length || 0}
          </h2>
          {editMode && (
            <button
              onClick={addItem}
              className="text-sm text-accent hover:text-accent-dark font-medium flex items-center gap-1"
            >
              + Add responsibility
            </button>
          )}
        </div>

        {(!view.items || view.items.length === 0) && !editMode ? (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No responsibilities yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {view.items?.map((item, idx) => (
              <li
                key={item.id}
                className="bg-white border border-ink-200 rounded-lg p-5 hover:shadow-sm transition slide-right"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                {editMode ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveItem(item.id, -1)}
                          className="text-ink-300 hover:text-ink-700"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveItem(item.id, 1)}
                          className="text-ink-300 hover:text-ink-700"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <input
                        value={item.title}
                        onChange={(e) => updateItem(item.id, { title: e.target.value })}
                        placeholder="Responsibility title"
                        className="flex-1 px-3 py-2 bg-ink-50 border border-ink-200 rounded font-medium text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <select
                        value={item.status || 'active'}
                        onChange={(e) => updateItem(item.id, { status: e.target.value })}
                        className="px-3 py-2 bg-ink-50 border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="active">Active</option>
                        <option value="review">Under Review</option>
                        <option value="transitioning">Transitioning</option>
                      </select>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition text-sm"
                      >
                        Delete
                      </button>
                    </div>
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                      placeholder="Notes — partners, frequency, context, links…"
                      rows={3}
                      className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded text-sm text-ink-700 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-medium text-ink-900 text-lg leading-tight">
                        {item.title || <span className="italic text-ink-400">Untitled</span>}
                      </h3>
                      {item.status && STATUS_LABELS[item.status] && (
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${STATUS_LABELS[item.status].tone} flex-shrink-0`}
                        >
                          {STATUS_LABELS[item.status].label}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-ink-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {item.notes}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
