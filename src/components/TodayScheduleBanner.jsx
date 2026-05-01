import { useEffect, useState } from 'react'
import {
  ensureTodayInstances,
  listTaskInstances,
  closeTaskInstance,
  reopenTaskInstance,
  listTabs,
  todayDateString,
} from '../lib/db'

export default function TodayScheduleBanner({ currentUser, role, onChanged }) {
  const [instances, setInstances] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showClosed, setShowClosed] = useState(false)

  async function refresh() {
    try {
      // Make sure today's instances exist (creates any missing for today's templates)
      await ensureTodayInstances()
      const today = todayDateString()
      const [inst, t] = await Promise.all([
        listTaskInstances({ date: today }),
        listTabs(),
      ])
      setInstances(inst)
      setTabs(t)
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

  async function handleClose(inst) {
    const closer = currentUser?.displayName || (role === 'admin' ? 'Amit (admin)' : 'anonymous')
    try {
      await closeTaskInstance(inst.id, closer)
      await refresh()
      onChanged?.()
    } catch (err) {
      alert(`Could not close: ${err.message}`)
    }
  }

  async function handleReopen(inst) {
    try {
      await reopenTaskInstance(inst.id)
      await refresh()
      onChanged?.()
    } catch (err) {
      alert(`Could not reopen: ${err.message}`)
    }
  }

  if (loading) return null
  if (error) {
    return (
      <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        Schedule: {error}
      </div>
    )
  }
  if (instances.length === 0) return null

  const open = instances.filter((i) => i.status === 'open')
  const closed = instances.filter((i) => i.status === 'closed')

  // If everything is closed, render a subtle "all done" bar
  if (open.length === 0 && !showClosed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm text-emerald-800 font-medium">
          All {instances.length} of today's scheduled tasks are closed.
        </span>
        <button
          onClick={() => setShowClosed(true)}
          className="ml-auto text-xs text-emerald-700 hover:text-emerald-900 underline"
        >
          Show
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-accent/10 to-amber-50 border-2 border-accent/30 rounded-lg p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-xl text-ink-900 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c46a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Today's schedule
          <span className="text-sm font-normal text-ink-500 tabular">
            · {open.length} open
            {closed.length > 0 && <span className="text-ink-400"> · {closed.length} closed</span>}
          </span>
        </h2>
        {closed.length > 0 && (
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="text-xs text-ink-500 hover:text-ink-900 underline"
          >
            {showClosed ? 'Hide closed' : `Show ${closed.length} closed`}
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {open.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            tabs={tabs}
            onClose={() => handleClose(inst)}
            isAdmin={role === 'admin'}
          />
        ))}
        {showClosed && closed.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            tabs={tabs}
            onReopen={() => handleReopen(inst)}
            isAdmin={role === 'admin'}
          />
        ))}
      </ul>
    </div>
  )
}

function InstanceRow({ instance, tabs, onClose, onReopen, isAdmin }) {
  const inst = instance
  const person = tabs.find((t) => t.id === inst.personId)
  const isOpen = inst.status === 'open'

  return (
    <li
      className={`bg-white border rounded p-3 flex items-center gap-3 ${
        isOpen ? 'border-ink-200' : 'border-ink-100 opacity-70'
      }`}
    >
      <span
        className="w-1 h-10 rounded-sm flex-shrink-0"
        style={{ background: inst.color || '#c46a3a' }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${isOpen ? 'text-ink-900' : 'text-ink-500 line-through'}`}>
            {inst.name}
          </span>
          {person ? (
            <span
              className="px-2 py-0.5 text-[11px] font-medium rounded"
              style={{
                background: person.color || '#c46a3a',
                color: getTextColor(person.color || '#c46a3a'),
              }}
            >
              {person.name}
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[11px] bg-amber-100 text-amber-800 rounded border border-amber-200 italic">
              unassigned
            </span>
          )}
        </div>
        {!isOpen && inst.closedBy && (
          <div className="text-[11px] text-ink-400 mt-0.5">
            Closed by <span className="text-ink-600">{inst.closedBy}</span>
            {inst.closedAt && <span> · {new Date(inst.closedAt).toLocaleString()}</span>}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        {isOpen ? (
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark done
          </button>
        ) : (
          isAdmin && (
            <button
              onClick={onReopen}
              className="px-2 py-1 text-[11px] text-ink-500 hover:text-ink-900 underline"
            >
              Reopen
            </button>
          )
        )}
      </div>
    </li>
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
