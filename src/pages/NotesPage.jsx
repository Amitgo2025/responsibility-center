import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listAllNotes,
  listAllResponsibilities,
  listTabs,
  listTags,
  listTagCategories,
  updateNoteStatus,
  deleteNote,
} from '../lib/db'
import { NoteCard } from '../components/NotesViewer'

export default function NotesPage({ role }) {
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const [notes, setNotes] = useState([])
  const [responsibilities, setResponsibilities] = useState([])
  const [tabs, setTabs] = useState([])
  const [tags, setTags] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('open') // 'open' | 'closed' | 'all'
  const [personFilter, setPersonFilter] = useState('')
  const [search, setSearch] = useState('')

  async function refresh() {
    try {
      const [n, r, t, tg, c] = await Promise.all([
        listAllNotes(),
        listAllResponsibilities(),
        listTabs(),
        listTags(),
        listTagCategories(),
      ])
      setNotes(n)
      setResponsibilities(r)
      setTabs(t)
      setTags(tg)
      setCategories(c)
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

  const respById = useMemo(() => {
    const map = {}
    responsibilities.forEach((r) => (map[r.id] = r))
    return map
  }, [responsibilities])

  const personById = useMemo(() => {
    const map = {}
    tabs.forEach((t) => (map[t.id] = t))
    return map
  }, [tabs])

  const filtered = useMemo(() => {
    const lc = search.trim().toLowerCase()
    return notes
      .filter((n) => {
        if (statusFilter !== 'all' && n.status !== statusFilter) return false
        if (personFilter && n.personId !== personFilter) return false
        if (lc) {
          const respTitle = respById[n.responsibilityId]?.title || ''
          const hay = [n.title, n.body, n.author, respTitle].join(' ').toLowerCase()
          if (!hay.includes(lc)) return false
        }
        return true
      })
      .map((n) => ({ ...n, _respTitle: respById[n.responsibilityId]?.title }))
  }, [notes, statusFilter, personFilter, search, respById])

  const openCount = notes.filter((n) => n.status === 'open').length
  const closedCount = notes.filter((n) => n.status === 'closed').length

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-5xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
            Notes & Requests
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-2">Inbox</h1>
          <p className="text-ink-500 text-sm">
            Everything the team opens here flows to Amit. Open notes need attention; closed notes
            are resolved or archived.
          </p>
        </div>
      </header>

      <div className="px-10 py-6 max-w-5xl">
        {/* Filters */}
        <div className="bg-white border border-ink-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                statusFilter === 'open'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              Open <span className="opacity-70 tabular">· {openCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter('closed')}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                statusFilter === 'closed'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              Closed <span className="opacity-70 tabular">· {closedCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
                statusFilter === 'all'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              All <span className="opacity-70 tabular">· {notes.length}</span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="px-2 py-1.5 text-sm bg-white border border-ink-200 rounded focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All people</option>
                {tabs.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full px-3 py-2 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {loading && <p className="text-ink-400 text-sm">Loading…</p>}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No notes match these filters.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((note) => {
            const resp = respById[note.responsibilityId]
            const person = personById[note.personId]
            return (
              <div key={note.id}>
                <button
                  onClick={() => resp && navigate(`/tab/${resp.personId}`)}
                  className="text-[11px] text-ink-400 hover:text-ink-700 mb-1 ml-1 tracking-wide"
                >
                  → {person?.name || note.personId} / {resp?.title || '(deleted responsibility)'}
                </button>
                <NoteCard
                  note={note}
                  allTags={tags}
                  allCategories={categories}
                  isAdmin={isAdmin}
                  showResponsibilityHint={true}
                  onToggleStatus={async () => {
                    await updateNoteStatus(note.id, note.status === 'open' ? 'closed' : 'open')
                    await refresh()
                  }}
                  onDelete={async () => {
                    if (!confirm('Delete this note?')) return
                    await deleteNote(note.id)
                    await refresh()
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
