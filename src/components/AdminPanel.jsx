import { useState } from 'react'
import { changePasswords } from '../lib/auth'
import { saveTab, deleteTab as removeTab, newItemId } from '../lib/db'

const PRESET_COLORS = [
  '#1c1815', '#3a342e', '#544c43', '#7a7165', '#a89e91',
  '#c46a3a', '#a8501f', '#e08a5a',
  '#2d4a3e', '#3d5a8a', '#6b3d8a', '#8a3d5a',
]

export default function AdminPanel({ onClose, tabs, onTabsChanged }) {
  const [tab, setTab] = useState('passwords')

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
          <div className="flex gap-1">
            <TabButton active={tab === 'passwords'} onClick={() => setTab('passwords')}>
              Passwords
            </TabButton>
            <TabButton active={tab === 'tabs'} onClick={() => setTab('tabs')}>
              Manage tabs
            </TabButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'passwords' && <PasswordSection />}
          {tab === 'tabs' && <TabsSection tabs={tabs} onChange={onTabsChanged} />}
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

      <div className="border-t border-ink-200 pt-4">
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

function TabsSection({ tabs, onChange }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    id: '',
    name: '',
    role: '',
    contributionShare: '',
    color: PRESET_COLORS[5],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function startCreate() {
    setForm({
      id: '',
      name: '',
      role: '',
      contributionShare: '',
      color: PRESET_COLORS[5],
    })
    setError('')
    setCreating(true)
  }

  async function submitCreate(e) {
    e.preventDefault()
    setError('')
    const id = form.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!id) return setError('ID is required (letters, numbers, dashes)')
    if (tabs.find((t) => t.id === id)) return setError('A tab with that ID already exists')
    if (!form.name.trim()) return setError('Name is required')

    setSubmitting(true)
    try {
      const maxOrder = tabs.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0)
      await saveTab(id, {
        name: form.name.trim(),
        role: form.role.trim(),
        contributionShare: form.contributionShare === '' ? null : Number(form.contributionShare),
        color: form.color,
        sortOrder: maxOrder + 1,
        items: [],
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
          {tabs.length} tab{tabs.length === 1 ? '' : 's'} total. Edit content directly from each tab.
        </p>
        {!creating && (
          <button
            onClick={startCreate}
            className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition"
          >
            + New tab
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contribution share %">
              <input
                type="number"
                value={form.contributionShare}
                onChange={(e) => setForm({ ...form, contributionShare: e.target.value })}
                placeholder="(optional)"
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
          </div>

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
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-ink-900">{t.name}</span>
                <span className="text-xs text-ink-400 font-mono">/{t.id}</span>
              </div>
              <div className="text-xs text-ink-500 truncate">{t.role}</div>
            </div>
            <span className="text-xs text-ink-400 tabular">
              {t.items?.length || 0} item{t.items?.length === 1 ? '' : 's'}
            </span>
            {confirmDeleteId === t.id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={submitting}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded"
                >
                  Confirm
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
