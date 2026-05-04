import { useEffect, useState } from 'react'
import { changePasswords } from '../lib/auth'
import {
  saveTab,
  deleteTab as removeTab,
  listTabs,
  listTagCategories,
  createTagCategory,
  updateTagCategory,
  deleteTagCategory,
  listTags,
  createTag,
  updateTag,
  deleteTag,
} from '../lib/db'

const PRESET_COLORS = [
  '#1c1815', '#3a342e', '#544c43', '#7a7165', '#a89e91',
  '#c46a3a', '#a8501f', '#e08a5a',
  '#2d4a3e', '#3d5a8a', '#6b3d8a', '#8a3d5a',
  '#4285F4', '#1877F2', '#0066CC', '#F49A1A', '#00A86B',
]

export default function AdminPanel({ onClose, tabs, onTabsChanged }) {
  const [tab, setTab] = useState('passwords')

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
          <h2 className="font-display text-2xl text-ink-900">Admin settings</h2>
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

        <div className="px-6 pt-4 border-b border-ink-200">
          <div className="flex gap-1 flex-wrap">
            <TabButton active={tab === 'passwords'} onClick={() => setTab('passwords')}>
              Passwords
            </TabButton>
            <TabButton active={tab === 'people'} onClick={() => setTab('people')}>
              People
            </TabButton>
            <TabButton active={tab === 'tags'} onClick={() => setTab('tags')}>
              Tags & Categories
            </TabButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'passwords' && <PasswordSection />}
          {tab === 'people' && <PeopleSection tabs={tabs} onChange={onTabsChanged} />}
          {tab === 'tags' && <TagsSection />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition ${
        active
          ? 'border-accent text-ink-900'
          : 'border-transparent text-ink-400 hover:text-ink-700'
      }`}
    >
      {children}
    </button>
  )
}

// =================== PASSWORDS ===================
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [newViewer, setNewViewer] = useState('')
  const [newAdmin, setNewAdmin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      if (!newViewer && !newAdmin) {
        throw new Error('Enter at least one new password to update.')
      }
      await changePasswords({
        currentAdminPassword: current,
        newViewerPassword: newViewer || undefined,
        newAdminPassword: newAdmin || undefined,
      })
      setMessage({ kind: 'ok', text: 'Passwords updated.' })
      setCurrent('')
      setNewViewer('')
      setNewAdmin('')
    } catch (err) {
      setMessage({ kind: 'err', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink-500 leading-relaxed">
        Confirm the current admin password, then enter new values for whichever password you want to
        change. Leave fields blank to keep them as-is.
      </p>

      <Field label="Current admin password (required to confirm)">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className="w-full px-3 py-2 bg-white border border-ink-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </Field>

      <div className="border-t border-ink-200 pt-4 space-y-4">
        <Field label="New viewer password (optional)">
          <input
            type="text"
            value={newViewer}
            onChange={(e) => setNewViewer(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full px-3 py-2 bg-white border border-ink-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </Field>
        <Field label="New admin password (optional)">
          <input
            type="text"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full px-3 py-2 bg-white border border-ink-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </Field>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded text-sm ${
            message.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !current}
        className="px-4 py-2 bg-ink-900 text-ink-50 rounded text-sm hover:bg-ink-800 disabled:opacity-40 transition"
      >
        {submitting ? 'Updating…' : 'Update passwords'}
      </button>
    </form>
  )
}

// =================== PEOPLE ===================
function PeopleSection({ tabs, onChange }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', role: '', color: PRESET_COLORS[5] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function startCreate() {
    setForm({ id: '', name: '', role: '', color: PRESET_COLORS[5] })
    setError('')
    setCreating(true)
  }

  async function submitCreate(e) {
    e.preventDefault()
    setError('')
    const id = form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!id) return setError('ID is required (letters, numbers, dashes)')
    if (tabs.find((t) => t.id === id)) return setError('A person with that ID already exists')
    if (!form.name.trim()) return setError('Name is required')

    setSubmitting(true)
    try {
      const maxOrder = tabs.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0)
      await saveTab(id, {
        name: form.name.trim(),
        role: form.role.trim(),
        color: form.color,
        sortOrder: maxOrder + 1,
      })
      setCreating(false)
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    setSubmitting(true)
    try {
      await removeTab(id)
      setConfirmDeleteId(null)
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {tabs.length} {tabs.length === 1 ? 'person' : 'people'}. Edit per-person info from each tab.
        </p>
        {!creating && (
          <button
            onClick={startCreate}
            className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition"
          >
            + New person
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={submitCreate} className="bg-white border border-ink-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID (URL slug)">
              <input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. maya"
                className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </Field>
            <Field label="Display name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Maya"
                className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </Field>
          </div>
          <Field label="Role / subtitle">
            <input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="e.g. Head of Growth & Partnerships"
              className="w-full px-3 py-2 bg-ink-50 border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          <Field label="Accent color">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    form.color === c ? 'border-ink-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-ink-900 text-ink-50 text-sm rounded hover:bg-ink-800 disabled:opacity-40 transition"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 bg-ink-100 text-ink-700 text-sm rounded hover:bg-ink-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-ink-200 border border-ink-200 rounded-lg bg-white">
        {tabs.map((t) => (
          <li key={t.id} className="px-4 py-3 flex items-center gap-3">
            <span
              className="w-3 h-8 rounded-sm flex-shrink-0"
              style={{ background: t.color || '#c46a3a' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium text-ink-900">{t.name}</span>
                <span className="text-xs text-ink-400 font-mono">/{t.id}</span>
                {t.isManager && (
                  <span className="text-[9px] uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                    Manager
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-500 truncate">{t.role}</div>
            </div>
            <button
              onClick={async () => {
                try {
                  await saveTab(t.id, { isManager: !t.isManager })
                  onChange?.()
                } catch (err) {
                  setError(err.message)
                }
              }}
              className={`px-2 py-1 text-[11px] rounded transition ${
                t.isManager
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
              title={
                t.isManager
                  ? 'This person has full admin powers when logged in. Click to remove.'
                  : 'Grant admin-equivalent powers to this person.'
              }
            >
              {t.isManager ? '★ Manager' : '+ Make manager'}
            </button>
            {confirmDeleteId === t.id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={submitting}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded"
                >
                  Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 bg-ink-100 text-ink-700 text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(t.id)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// =================== TAGS & CATEGORIES ===================
function TagsSection() {
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const [c, t] = await Promise.all([listTagCategories(), listTags()])
      setCategories(c)
      setTags(t)
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

  // New category state
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  async function addCategory() {
    if (!newCatName.trim()) return
    setCreatingCat(true)
    try {
      await createTagCategory({ name: newCatName.trim() })
      setNewCatName('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingCat(false)
    }
  }

  async function renameCategory(id, name) {
    try {
      await updateTagCategory(id, { name })
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeCategory(id) {
    if (!confirm('Delete this category? All tags inside will be removed and stripped from any responsibilities.')) return
    try {
      await deleteTagCategory(id)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="text-ink-400 text-sm">Loading…</p>

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-500 leading-relaxed">
        Categories group tags. Create as many as you need (Platform, Type, Frequency, Priority…).
        Each tag belongs to exactly one category. Deleting a tag or category removes it from any
        responsibility that used it.
      </p>

      <div className="flex gap-2">
        <input
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="New category name (e.g. Priority, Region…)"
          className="flex-1 px-3 py-2 bg-white border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onKeyDown={(e) => {
            if (e.key === 'Enter') addCategory()
          }}
        />
        <button
          onClick={addCategory}
          disabled={!newCatName.trim() || creatingCat}
          className="px-3 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded transition disabled:opacity-40"
        >
          + Category
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white border border-dashed border-ink-200 rounded-lg p-6 text-center">
          <p className="text-ink-400 text-sm">No categories yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              tags={tags.filter((t) => t.categoryId === cat.id)}
              onRename={(name) => renameCategory(cat.id, name)}
              onDelete={() => removeCategory(cat.id)}
              onChange={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBlock({ category, tags, onRename, onDelete, onChange }) {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(category.name)
  const [showAdd, setShowAdd] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(PRESET_COLORS[5])

  async function saveTagNew() {
    if (!tagName.trim()) return
    try {
      await createTag({ categoryId: category.id, name: tagName.trim(), color: tagColor })
      setTagName('')
      setShowAdd(false)
      onChange?.()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="bg-white border border-ink-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        {editingName ? (
          <div className="flex gap-1 items-center">
            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            <button
              onClick={async () => {
                await onRename(tempName)
                setEditingName(false)
              }}
              className="text-accent text-xs"
            >
              Save
            </button>
            <button
              onClick={() => {
                setTempName(category.name)
                setEditingName(false)
              }}
              className="text-ink-400 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <h3 className="font-medium text-ink-900">{category.name}</h3>
            <button onClick={() => setEditingName(true)} className="text-xs text-ink-400 hover:text-ink-700">
              rename
            </button>
            <span className="text-xs text-ink-400 tabular">· {tags.length} tags</span>
          </div>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-2 py-0.5 text-xs text-accent hover:text-accent-dark"
          >
            + Tag
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-0.5 text-xs text-red-600 hover:text-red-800"
          >
            Delete category
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-ink-50 border border-ink-200 rounded p-3 mb-3 space-y-2">
          <input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name"
            className="w-full px-2 py-1.5 bg-white border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            onKeyDown={(e) => { if (e.key === 'Enter') saveTagNew() }}
          />
          <div className="flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTagColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  tagColor === c ? 'border-ink-900 scale-110' : 'border-transparent'
                }`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer ml-1"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveTagNew}
              disabled={!tagName.trim()}
              className="px-3 py-1 bg-ink-900 text-ink-50 text-xs rounded hover:bg-ink-800 disabled:opacity-40"
            >
              Add tag
            </button>
            <button
              onClick={() => { setTagName(''); setShowAdd(false) }}
              className="px-3 py-1 bg-ink-100 text-ink-700 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tags.length === 0 ? (
        <p className="text-xs text-ink-400 italic">No tags in this category yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagPill key={tag.id} tag={tag} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  )
}

function TagPill({ tag, onChange }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)

  async function save() {
    try {
      await updateTag(tag.id, { name, color })
      setEditing(false)
      onChange?.()
    } catch (err) {
      alert(err.message)
    }
  }

  async function remove() {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from any responsibility using it.`)) return
    try {
      await deleteTag(tag.id)
      onChange?.()
    } catch (err) {
      alert(err.message)
    }
  }

  if (editing) {
    return (
      <div className="bg-ink-50 border border-ink-200 rounded p-2 flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-2 py-0.5 bg-white border border-ink-200 rounded text-xs w-28 focus:outline-none"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <button onClick={save} className="text-accent text-xs px-1">Save</button>
        <button onClick={() => { setName(tag.name); setColor(tag.color); setEditing(false) }} className="text-ink-400 text-xs px-1">×</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group">
      <span
        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
        style={{ background: tag.color, color: getTextColor(tag.color) }}
      >
        {tag.name}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="text-[10px] text-ink-400 hover:text-ink-700 opacity-0 group-hover:opacity-100 transition"
      >
        edit
      </button>
      <button
        onClick={remove}
        className="text-[10px] text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition"
      >
        ×
      </button>
    </div>
  )
}

function getTextColor(hex) {
  if (!hex || !hex.startsWith('#')) return '#ffffff'
  const h = hex.length === 4 ? '#' + hex.slice(1).split('').map((c) => c + c).join('') : hex
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1c1815' : '#ffffff'
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
        {label}
      </span>
      {children}
    </label>
  )
}
