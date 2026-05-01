import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getTab,
  saveTab,
  listResponsibilities,
  listTags,
  listTagCategories,
  listAllNotes,
  deleteResponsibility,
  reorderResponsibility,
} from '../lib/db'
import ResponsibilityRow from './ResponsibilityRow'
import ResponsibilityEditor from './ResponsibilityEditor'
import NoteDialog from './NoteDialog'
import NotesViewer from './NotesViewer'

export default function TabView({ role, currentUser, tabs, onTabsChanged }) {
  const { tabId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(null)
  const [editingTab, setEditingTab] = useState(false)
  const [draftTab, setDraftTab] = useState(null)
  const [savingTab, setSavingTab] = useState(false)

  const [media, setMedia] = useState([])
  const [other, setOther] = useState([])
  const [allTags, setAllTags] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [allNotes, setAllNotes] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorState, setEditorState] = useState(null) // { mode, defaultSection, responsibility }
  const [noteDialogFor, setNoteDialogFor] = useState(null) // responsibility
  const [viewingNotesFor, setViewingNotesFor] = useState(null) // responsibility

  const isAdmin = role === 'admin'

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [t, mediaResp, otherResp, tags, cats, notes] = await Promise.all([
        getTab(tabId),
        listResponsibilities({ personId: tabId, section: 'media' }),
        listResponsibilities({ personId: tabId, section: 'other' }),
        listTags(),
        listTagCategories(),
        listAllNotes(),
      ])
      if (!t) {
        setError(`Tab "${tabId}" not found.`)
        return
      }
      setTab(t)
      setMedia(mediaResp)
      setOther(otherResp)
      setAllTags(tags)
      setAllCategories(cats)
      setAllNotes(notes)
    } catch (err) {
      setError(`Could not load: ${err.message}`)
    }
  }, [tabId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setEditingTab(false)
    setDraftTab(null)
    ;(async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [tabId, refresh])

  function noteCountFor(respId) {
    return allNotes.filter((n) => n.responsibilityId === respId).length
  }
  function openNoteCountFor(respId) {
    return allNotes.filter((n) => n.responsibilityId === respId && n.status === 'open').length
  }

  async function handleDelete(resp) {
    if (!confirm(`Delete "${resp.title}"? This also removes any notes attached to it.`)) return
    try {
      await deleteResponsibility(resp.id)
      await refresh()
    } catch (err) {
      alert(`Could not delete: ${err.message}`)
    }
  }

  async function handleMove(resp, dir) {
    const list = resp.section === 'media' ? media : other
    try {
      await reorderResponsibility(resp.id, list, dir)
      await refresh()
    } catch (err) {
      alert(`Could not reorder: ${err.message}`)
    }
  }

  function startEditingTab() {
    setDraftTab({ name: tab.name, role: tab.role, color: tab.color })
    setEditingTab(true)
  }

  async function saveTabEdits() {
    setSavingTab(true)
    try {
      await saveTab(tab.id, draftTab)
      setTab({ ...tab, ...draftTab })
      setEditingTab(false)
      setDraftTab(null)
      onTabsChanged?.()
    } catch (err) {
      alert(`Could not save: ${err.message}`)
    } finally {
      setSavingTab(false)
    }
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

  return (
    <main className="flex-1 bg-paper min-h-screen">
      {/* Hero */}
      <header
        className="relative overflow-hidden border-b border-ink-200"
        style={{ background: `linear-gradient(135deg, ${tab.color || '#1c1815'} 0%, #1c1815 100%)` }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative px-10 py-12 max-w-5xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-200 mb-2">Zone</div>
          {editingTab ? (
            <div className="space-y-3">
              <input
                value={draftTab.name}
                onChange={(e) => setDraftTab({ ...draftTab, name: e.target.value })}
                className="font-display text-5xl bg-transparent text-ink-50 border-b border-ink-300/40 focus:outline-none focus:border-ink-50 w-full mb-2"
              />
              <input
                value={draftTab.role}
                onChange={(e) => setDraftTab({ ...draftTab, role: e.target.value })}
                placeholder="Role description"
                className="text-ink-100 bg-transparent border-b border-ink-300/40 focus:outline-none focus:border-ink-50 w-full"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-200 uppercase tracking-wider">Color:</span>
                <input
                  type="color"
                  value={draftTab.color}
                  onChange={(e) => setDraftTab({ ...draftTab, color: e.target.value })}
                  className="w-10 h-8 rounded cursor-pointer"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveTabEdits}
                  disabled={savingTab}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition disabled:opacity-50"
                >
                  {savingTab ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingTab(false); setDraftTab(null) }}
                  className="px-3 py-1.5 bg-ink-50/10 text-ink-50 text-sm rounded backdrop-blur"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-5xl text-ink-50 leading-none mb-2">{tab.name}</h1>
              <p className="text-ink-100 italic">{tab.role}</p>
              {isAdmin && (
                <button
                  onClick={startEditingTab}
                  className="mt-6 px-3 py-1.5 bg-ink-50/10 hover:bg-ink-50/20 text-ink-50 text-sm rounded backdrop-blur transition"
                >
                  Edit tab info
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="px-10 py-10 max-w-5xl space-y-12">
        <Section
          title="Media Buying Tasks"
          subtitle="Ongoing target tasks — the lanes from the team structure"
          icon="media"
          items={media}
          allTags={allTags}
          allCategories={allCategories}
          isAdmin={isAdmin}
          noteCountFor={noteCountFor}
          openNoteCountFor={openNoteCountFor}
          onAdd={() =>
            setEditorState({ mode: 'create', defaultSection: 'media' })
          }
          onEdit={(r) => setEditorState({ mode: 'edit', responsibility: r })}
          onDelete={handleDelete}
          onMove={handleMove}
          onOpenNote={(r) => setNoteDialogFor(r)}
          onViewNotes={(r) => setViewingNotesFor(r)}
        />

        <Section
          title="Other Responsibilities"
          subtitle="Cross-cutting ownership — reports, accounts, compliance, infra"
          icon="other"
          items={other}
          allTags={allTags}
          allCategories={allCategories}
          isAdmin={isAdmin}
          noteCountFor={noteCountFor}
          openNoteCountFor={openNoteCountFor}
          onAdd={() =>
            setEditorState({ mode: 'create', defaultSection: 'other' })
          }
          onEdit={(r) => setEditorState({ mode: 'edit', responsibility: r })}
          onDelete={handleDelete}
          onMove={handleMove}
          onOpenNote={(r) => setNoteDialogFor(r)}
          onViewNotes={(r) => setViewingNotesFor(r)}
        />
      </div>

      {editorState && (
        <ResponsibilityEditor
          mode={editorState.mode}
          responsibility={editorState.responsibility}
          defaultPersonId={tabId}
          defaultSection={editorState.defaultSection}
          tabs={tabs}
          currentUser={currentUser}
          onClose={() => setEditorState(null)}
          onSaved={() => refresh()}
        />
      )}

      {noteDialogFor && (
        <NoteDialog
          responsibility={noteDialogFor}
          person={tab}
          currentUser={currentUser}
          onClose={() => setNoteDialogFor(null)}
          onCreated={() => refresh()}
        />
      )}

      {viewingNotesFor && (
        <NotesViewer
          responsibility={viewingNotesFor}
          isAdmin={isAdmin}
          onClose={() => setViewingNotesFor(null)}
          onChanged={() => refresh()}
        />
      )}
    </main>
  )
}

function Section({
  title,
  subtitle,
  icon,
  items,
  allTags,
  allCategories,
  isAdmin,
  noteCountFor,
  openNoteCountFor,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onOpenNote,
  onViewNotes,
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display text-2xl text-ink-900 flex items-center gap-2">
          {icon === 'media' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c46a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#544c43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          {title}
          <span className="text-sm font-normal text-ink-400 tabular">· {items.length}</span>
        </h2>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="text-sm text-accent hover:text-accent-dark font-medium"
          >
            + Add responsibility
          </button>
        )}
      </div>
      <p className="text-sm text-ink-500 mb-5">{subtitle}</p>

      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-ink-200 rounded-lg p-10 text-center">
          <p className="text-ink-400 text-sm">No responsibilities in this section yet.</p>
          {isAdmin && (
            <button
              onClick={onAdd}
              className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
            >
              + Add the first one
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r, idx) => (
            <ResponsibilityRow
              key={r.id}
              index={idx}
              responsibility={r}
              allTags={allTags}
              allCategories={allCategories}
              isAdmin={isAdmin}
              noteCount={noteCountFor(r.id)}
              openNoteCount={openNoteCountFor(r.id)}
              onEdit={() => onEdit(r)}
              onDelete={() => onDelete(r)}
              onMoveUp={() => onMove(r, -1)}
              onMoveDown={() => onMove(r, 1)}
              onOpenNote={() => onOpenNote(r)}
              onViewNotes={() => onViewNotes(r)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
