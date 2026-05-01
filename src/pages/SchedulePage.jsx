import { useEffect, useMemo, useState } from 'react'
import {
  listScheduleTasks,
  createScheduleTask,
  updateScheduleTask,
  deleteScheduleTask,
  setScheduleAssignments,
  listTabs,
  generateScheduledDates,
  todayDateString,
} from '../lib/db'

const PRESET_COLORS = [
  '#c46a3a', '#a8501f', '#4285F4', '#1877F2', '#0066CC',
  '#00A86B', '#7B68EE', '#8a3d3d', '#3d5a8a', '#1c1815',
]

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SchedulePage({ role }) {
  const isAdmin = role === 'admin'
  const [tasks, setTasks] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // task or { _new: true }
  const [assigning, setAssigning] = useState(null) // task being assigned

  async function refresh() {
    try {
      const [t, p] = await Promise.all([listScheduleTasks(), listTabs()])
      setTasks(t)
      setTabs(p)
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

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-6xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
            Schedule
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-2">
            Daily & recurring tasks
          </h1>
          <p className="text-ink-500 text-sm leading-relaxed max-w-2xl">
            Define recurring tasks (e.g. "update reports daily") and assign each upcoming day to a
            specific person. The day's tasks appear at the top of All Responsibilities and stay
            open until someone closes them.
          </p>
        </div>
      </header>

      <div className="px-10 py-6 max-w-6xl">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-ink-500">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setEditing({ _new: true })}
              className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition"
            >
              + New scheduled task
            </button>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No scheduled tasks yet.</p>
            {isAdmin && (
              <button
                onClick={() => setEditing({ _new: true })}
                className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
              >
                + Create the first one
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                tabs={tabs}
                isAdmin={isAdmin}
                onEdit={() => setEditing(task)}
                onAssign={() => setAssigning(task)}
                onDelete={async () => {
                  if (!confirm(`Delete "${task.name}"? This removes the template and any pending instances.`)) return
                  await deleteScheduleTask(task.id)
                  await refresh()
                }}
                onToggleActive={async () => {
                  await updateScheduleTask(task.id, { active: !task.active })
                  await refresh()
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <TaskEditor
          task={editing._new ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}

      {assigning && (
        <AssignmentCalendar
          task={assigning}
          tabs={tabs}
          onClose={() => setAssigning(null)}
          onSaved={async () => {
            setAssigning(null)
            await refresh()
          }}
        />
      )}
    </main>
  )
}

// ============== TASK ROW ==============
function TaskRow({ task, tabs, isAdmin, onEdit, onAssign, onDelete, onToggleActive }) {
  // Show next 7 days assignment preview
  const preview = useMemo(() => {
    const today = todayDateString()
    const end = new Date(today + 'T00:00:00')
    end.setDate(end.getDate() + 13)
    const endStr = end.toISOString().slice(0, 10)
    const dates = generateScheduledDates(task, today, endStr)
    return dates.slice(0, 7).map((d) => ({
      date: d,
      personId: task.assignments?.[d] || '',
    }))
  }, [task])

  function cadenceLabel() {
    if (task.cadence === 'daily') return 'Daily'
    if (task.cadence === 'weekly') {
      const days = (task.daysOfWeek || []).map((d) => DAY_NAMES_SHORT[d]).join(', ')
      return `Weekly · ${days || '—'}`
    }
    if (task.cadence === 'dates') return `${(task.dates || []).length} specific date(s)`
    if (task.cadence === 'custom') return 'Custom (per-date)'
    return task.cadence
  }

  function personName(id) {
    return tabs.find((t) => t.id === id)?.name || ''
  }

  return (
    <li className={`bg-white border rounded-lg p-4 ${task.active ? 'border-ink-200' : 'border-ink-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className="w-1.5 h-12 rounded-sm flex-shrink-0"
            style={{ background: task.color || '#c46a3a' }}
          />
          <div className="min-w-0">
            <h3 className="font-medium text-ink-900 text-lg leading-tight">{task.name}</h3>
            <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{cadenceLabel()}</span>
              {task.deadlineTime && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-mono">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  by {task.deadlineTime}
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-sm text-ink-600 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleActive}
              className={`px-2 py-1 text-xs rounded transition ${
                task.active
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
            >
              {task.active ? 'Active' : 'Paused'}
            </button>
            <button onClick={onAssign} className="px-2.5 py-1 text-xs bg-accent hover:bg-accent-dark text-white rounded transition">
              Assign dates
            </button>
            <button onClick={onEdit} className="px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-100 rounded">
              Edit
            </button>
            <button onClick={onDelete} className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Next 7 occurrences preview */}
      {preview.length > 0 && (
        <div className="border-t border-ink-100 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-ink-400 font-medium mb-2">
            Upcoming
          </div>
          <div className="flex flex-wrap gap-2">
            {preview.map((p) => {
              const person = tabs.find((t) => t.id === p.personId)
              return (
                <div
                  key={p.date}
                  className={`text-xs px-2 py-1 rounded border ${
                    person ? 'bg-white border-ink-200' : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <span className="font-mono text-ink-500 mr-1.5">{formatShortDate(p.date)}</span>
                  {person ? (
                    <span className="font-medium text-ink-900">{person.name}</span>
                  ) : (
                    <span className="text-amber-700 italic">unassigned</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </li>
  )
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ============== TASK EDITOR ==============
function TaskEditor({ task, onClose, onSaved }) {
  const isCreate = !task
  const [name, setName] = useState(task?.name || '')
  const [description, setDescription] = useState(task?.description || '')
  const [cadence, setCadence] = useState(task?.cadence || 'daily')
  const [daysOfWeek, setDaysOfWeek] = useState(task?.daysOfWeek || [])
  const [dates, setDates] = useState(task?.dates || [])
  const [color, setColor] = useState(task?.color || '#c46a3a')
  const [deadlineTime, setDeadlineTime] = useState(task?.deadlineTime || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggleDay(d) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    )
  }

  function addDate(d) {
    if (!d) return
    setDates((prev) => (prev.includes(d) ? prev : [...prev, d].sort()))
  }
  function removeDate(d) {
    setDates((prev) => prev.filter((x) => x !== d))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        cadence,
        daysOfWeek: cadence === 'weekly' ? daysOfWeek : [],
        dates: cadence === 'dates' ? dates : [],
        color,
        deadlineTime: deadlineTime || '',
      }
      if (isCreate) {
        await createScheduleTask(payload)
      } else {
        await updateScheduleTask(task.id, payload)
      }
      onSaved?.()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-ink-200 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink-900">
            {isCreate ? 'New scheduled task' : 'Edit scheduled task'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Task name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Update daily reports"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quick context for whoever picks it up that day"
              className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Cadence
            </label>
            <div className="grid grid-cols-2 gap-2">
              <CadencePill v="daily" current={cadence} onSelect={setCadence} label="Daily" sub="Every day" />
              <CadencePill v="weekly" current={cadence} onSelect={setCadence} label="Weekly" sub="Specific weekdays" />
              <CadencePill v="dates" current={cadence} onSelect={setCadence} label="Specific dates" sub="One-off list" />
              <CadencePill v="custom" current={cadence} onSelect={setCadence} label="Custom" sub="Per-date assignment only" />
            </div>
          </div>

          {cadence === 'weekly' && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
                Days of the week
              </label>
              <div className="flex gap-1 flex-wrap">
                {DAY_NAMES_SHORT.map((dayName, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1.5 text-sm rounded border transition ${
                      daysOfWeek.includes(idx)
                        ? 'bg-accent text-white border-accent'
                        : 'bg-white border-ink-200 text-ink-700 hover:border-ink-400'
                    }`}
                  >
                    {dayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cadence === 'dates' && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
                Specific dates
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="date"
                  onChange={(e) => { addDate(e.target.value); e.target.value = '' }}
                  className="px-3 py-1.5 bg-white border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-xs text-ink-400 self-center">Pick a date to add</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-ink-100 rounded">
                    {d}
                    <button type="button" onClick={() => removeDate(d)} className="text-ink-400 hover:text-red-600">
                      ×
                    </button>
                  </span>
                ))}
                {dates.length === 0 && (
                  <span className="text-xs text-ink-400 italic">No dates yet</span>
                )}
              </div>
            </div>
          )}

          {cadence === 'custom' && (
            <div className="text-xs text-ink-500 italic px-3 py-2 bg-ink-50 rounded">
              "Custom" means the task only runs on dates you explicitly assign someone to in the
              calendar view. Useful for ad-hoc or rotating assignments.
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Color (shows in the day banner)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    color === c ? 'border-ink-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
              Deadline (Israel time, optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                lang="he-IL"
                step="60"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                style={{ fontFeatureSettings: '"tnum"' }}
              />
              {deadlineTime && (
                <button
                  type="button"
                  onClick={() => setDeadlineTime('')}
                  className="text-xs text-ink-500 hover:text-red-600"
                >
                  Clear
                </button>
              )}
              <span className="text-xs text-ink-400">
                Use 24-hour format (e.g. <span className="font-mono">18:00</span>). After this hour an unfinished task is logged as <span className="text-red-600 font-medium">missed</span>.
              </span>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-ink-200 flex justify-end gap-2 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-ink-100 text-ink-700 rounded text-sm hover:bg-ink-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-4 py-2 bg-ink-900 text-ink-50 rounded text-sm hover:bg-ink-800 disabled:opacity-40 transition"
          >
            {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CadencePill({ v, current, onSelect, label, sub }) {
  const active = current === v
  return (
    <button
      type="button"
      onClick={() => onSelect(v)}
      className={`text-left px-3 py-2 rounded border transition ${
        active
          ? 'bg-accent/10 border-accent text-ink-900'
          : 'bg-white border-ink-200 text-ink-700 hover:border-ink-400'
      }`}
    >
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-ink-500">{sub}</div>
    </button>
  )
}

// ============== ASSIGNMENT CALENDAR ==============
function AssignmentCalendar({ task, tabs, onClose, onSaved }) {
  // Show a month view; admin clicks a date to set/clear who owns it.
  // Quick-fill helpers: rotate through people, copy week, clear month.
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() } // 0-indexed month
  })
  const [assignments, setAssignments] = useState(task.assignments || {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bulkPersonId, setBulkPersonId] = useState('')

  function shiftMonth(delta) {
    setMonth((m) => {
      const d = new Date(m.year, m.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  // Build calendar grid: each row Sun-Sat, with empty cells for offsets
  const grid = useMemo(() => buildMonthGrid(month.year, month.month), [month])

  function dateKey(dateObj) {
    const y = dateObj.getFullYear()
    const m = String(dateObj.getMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function setAssignment(dateStr, personId) {
    setAssignments((prev) => {
      const next = { ...prev }
      if (!personId) {
        delete next[dateStr]
      } else {
        next[dateStr] = personId
      }
      return next
    })
  }

  function isDateInMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.getFullYear() === month.year && d.getMonth() === month.month
  }

  // Eligible dates within current month (based on cadence)
  function isEligible(dateStr, dayOfWeek) {
    if (task.cadence === 'daily') return true
    if (task.cadence === 'weekly') return (task.daysOfWeek || []).includes(dayOfWeek)
    if (task.cadence === 'dates') return (task.dates || []).includes(dateStr)
    if (task.cadence === 'custom') return true // any date is eligible
    return false
  }

  // Bulk fill: rotate through people on eligible dates this month
  function rotateThisMonth() {
    if (tabs.length === 0) return
    const eligible = []
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue
        const dStr = dateKey(cell)
        if (isEligible(dStr, cell.getDay())) eligible.push(dStr)
      }
    }
    const next = { ...assignments }
    eligible.forEach((d, i) => {
      next[d] = tabs[i % tabs.length].id
    })
    setAssignments(next)
  }

  // Bulk fill: assign one person to all eligible dates this month
  function fillWithPerson() {
    if (!bulkPersonId) return
    const next = { ...assignments }
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue
        const dStr = dateKey(cell)
        if (isEligible(dStr, cell.getDay())) next[dStr] = bulkPersonId
      }
    }
    setAssignments(next)
  }

  function clearThisMonth() {
    const next = { ...assignments }
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue
        const dStr = dateKey(cell)
        delete next[dStr]
      }
    }
    setAssignments(next)
  }

  async function handleSave() {
    setSubmitting(true)
    setError('')
    try {
      await setScheduleAssignments(task.id, assignments)
      onSaved?.()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const monthName = new Date(month.year, month.month, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  const todayStr = todayDateString()

  return (
    <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-ink-200 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-ink-400">Assign dates</div>
            <h2 className="font-display text-2xl text-ink-900 leading-tight truncate">{task.name}</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1 space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} className="px-2 py-1 text-sm hover:bg-ink-100 rounded">
              ← Prev
            </button>
            <h3 className="font-display text-xl text-ink-900">{monthName}</h3>
            <button onClick={() => shiftMonth(1)} className="px-2 py-1 text-sm hover:bg-ink-100 rounded">
              Next →
            </button>
          </div>

          {/* Quick-fill toolbar */}
          <div className="bg-white border border-ink-200 rounded p-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-ink-400 font-medium mr-1">
              Quick-fill this month:
            </span>
            <button
              onClick={rotateThisMonth}
              className="px-2.5 py-1 text-xs bg-ink-900 text-white rounded hover:bg-ink-800"
            >
              Rotate through team
            </button>
            <select
              value={bulkPersonId}
              onChange={(e) => setBulkPersonId(e.target.value)}
              className="px-2 py-1 text-xs bg-white border border-ink-200 rounded"
            >
              <option value="">— pick person —</option>
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={fillWithPerson}
              disabled={!bulkPersonId}
              className="px-2.5 py-1 text-xs bg-accent text-white rounded hover:bg-accent-dark disabled:opacity-40"
            >
              Fill all with this person
            </button>
            <button
              onClick={clearThisMonth}
              className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded ml-auto"
            >
              Clear month
            </button>
          </div>

          {/* Calendar grid */}
          <div className="bg-white border border-ink-200 rounded overflow-hidden">
            <div className="grid grid-cols-7 bg-ink-50 border-b border-ink-200">
              {DAY_NAMES_SHORT.map((name) => (
                <div key={name} className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-ink-500 font-medium text-center">
                  {name}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.flat().map((cell, idx) => {
                if (!cell) {
                  return <div key={idx} className="aspect-square border-b border-r border-ink-100 bg-ink-50/30" />
                }
                const dStr = dateKey(cell)
                const eligible = isEligible(dStr, cell.getDay())
                const personId = assignments[dStr] || ''
                const person = tabs.find((t) => t.id === personId)
                const isToday = dStr === todayStr
                return (
                  <div
                    key={idx}
                    className={`aspect-square border-b border-r border-ink-100 p-1.5 flex flex-col text-xs ${
                      eligible ? 'bg-white' : 'bg-ink-50/40'
                    } ${isToday ? 'ring-2 ring-accent ring-inset' : ''}`}
                  >
                    <div className={`text-[11px] tabular ${eligible ? 'text-ink-700 font-medium' : 'text-ink-300'}`}>
                      {cell.getDate()}
                    </div>
                    {eligible && (
                      <select
                        value={personId}
                        onChange={(e) => setAssignment(dStr, e.target.value)}
                        className="mt-auto text-[10px] px-1 py-0.5 bg-paper border border-ink-200 rounded focus:outline-none focus:ring-1 focus:ring-accent"
                        style={
                          person
                            ? {
                                background: person.color || '#c46a3a',
                                color: getTextColor(person.color || '#c46a3a'),
                                borderColor: person.color || '#c46a3a',
                              }
                            : undefined
                        }
                      >
                        <option value="">—</option>
                        {tabs.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-ink-200 flex justify-end gap-2 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-ink-100 text-ink-700 rounded text-sm hover:bg-ink-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 bg-ink-900 text-ink-50 rounded text-sm hover:bg-ink-800 disabled:opacity-40 transition"
          >
            {submitting ? 'Saving…' : 'Save assignments'}
          </button>
        </div>
      </div>
    </div>
  )
}

function buildMonthGrid(year, month) {
  // Returns 5-6 rows, each with 7 day-objects-or-null for offsets.
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const startOffset = first.getDay() // 0 Sunday
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
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
