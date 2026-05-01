import { useEffect, useState } from 'react'
import {
  ensureTodayInstances,
  listTaskInstances,
  closeTaskInstance,
  reopenTaskInstance,
  reassignTaskInstance,
  listTabs,
  todayDateString,
  effectiveStatus,
  formatIsraelTime,
  detectDeviceType,
} from '../lib/db'

export default function TodayScheduleBanner({ currentUser, role, onChanged, personId }) {
  const [instances, setInstances] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  const [now, setNow] = useState(new Date())

  async function refresh() {
    try {
      // Make sure today's instances exist (creates any missing for today's templates)
      await ensureTodayInstances()
      const today = todayDateString()
      const [inst, t] = await Promise.all([
        listTaskInstances({ date: today }),
        listTabs(),
      ])
      // If a personId filter is provided, narrow to that person only
      const filtered = personId ? inst.filter((i) => i.personId === personId) : inst
      setInstances(filtered)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  // Tick every 30s so the missed badge appears live as deadlines pass
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  async function handleClose(inst) {
    const closer = currentUser?.displayName || (role === 'admin' ? 'Amit (admin)' : 'anonymous')
    const device = detectDeviceType()
    try {
      await closeTaskInstance(inst.id, closer, device)
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

  async function handleReassign(inst, newPersonId) {
    try {
      await reassignTaskInstance(inst.id, newPersonId)
      await refresh()
      onChanged?.()
    } catch (err) {
      alert(`Could not reassign: ${err.message}`)
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

  // Group by effective status
  const open = []
  const missed = []
  const closed = []
  for (const inst of instances) {
    const eff = effectiveStatus(inst, now)
    if (eff === 'closed') closed.push(inst)
    else if (eff === 'missed') missed.push(inst)
    else open.push(inst)
  }

  const activeCount = open.length + missed.length

  // If everything is closed, render a subtle "all done" bar
  if (activeCount === 0 && !showClosed) {
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
    <div className={`border-2 rounded-lg p-4 shadow-sm ${
      missed.length > 0
        ? 'bg-gradient-to-br from-red-50 to-amber-50 border-red-300'
        : 'bg-gradient-to-br from-accent/10 to-amber-50 border-accent/30'
    }`}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-xl text-ink-900 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c46a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {personId ? "Today's tasks" : "Today's schedule"}
          <span className="text-sm font-normal text-ink-500 tabular">
            · {open.length} open
            {missed.length > 0 && <span className="text-red-700 font-medium"> · {missed.length} missed</span>}
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
        {missed.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            tabs={tabs}
            onClose={() => handleClose(inst)}
            onReassign={(newId) => handleReassign(inst, newId)}
            isAdmin={role === 'admin'}
            now={now}
          />
        ))}
        {open.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            tabs={tabs}
            onClose={() => handleClose(inst)}
            onReassign={(newId) => handleReassign(inst, newId)}
            isAdmin={role === 'admin'}
            now={now}
          />
        ))}
        {showClosed && closed.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            tabs={tabs}
            onReopen={() => handleReopen(inst)}
            onReassign={(newId) => handleReassign(inst, newId)}
            isAdmin={role === 'admin'}
            now={now}
          />
        ))}
      </ul>
    </div>
  )
}

function InstanceRow({ instance, tabs, onClose, onReopen, onReassign, isAdmin, now }) {
  const inst = instance
  const person = tabs.find((t) => t.id === inst.personId)
  const eff = effectiveStatus(inst, now)
  const [showReassign, setShowReassign] = useState(false)

  function deadlineLabel() {
    if (!inst.deadline) return null
    const dl = new Date(inst.deadline)
    const diffMs = dl.getTime() - (now?.getTime() || Date.now())
    const diffMin = Math.round(diffMs / 60000)
    if (eff === 'missed') {
      const overdueMin = Math.abs(diffMin)
      const h = Math.floor(overdueMin / 60)
      const m = overdueMin % 60
      const overdue = h > 0 ? `${h}h ${m}m` : `${m}m`
      return { label: `Missed at ${inst.deadlineTime} · ${overdue} overdue`, tone: 'text-red-700' }
    }
    if (eff === 'open') {
      if (diffMin <= 0) return null
      if (diffMin < 60) return { label: `Due by ${inst.deadlineTime} · ${diffMin}m left`, tone: 'text-amber-700' }
      return { label: `Due by ${inst.deadlineTime}`, tone: 'text-ink-500' }
    }
    return null
  }

  const dl = deadlineLabel()

  const containerClass =
    eff === 'missed'
      ? 'border-red-300 bg-red-50'
      : eff === 'closed'
      ? 'border-ink-100 opacity-70'
      : 'border-ink-200'

  return (
    <li className={`bg-white border rounded p-3 ${containerClass}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="w-1 h-10 rounded-sm flex-shrink-0"
          style={{ background: inst.color || '#c46a3a' }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${eff === 'closed' ? 'text-ink-500 line-through' : 'text-ink-900'}`}>
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
            {eff === 'missed' && (
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded bg-red-600 text-white font-bold">
                Missed
              </span>
            )}
          </div>
          {dl && <div className={`text-[11px] mt-0.5 font-mono ${dl.tone}`}>{dl.label}</div>}
          {eff === 'closed' && inst.closedBy && (
            <div className="text-[11px] text-ink-400 mt-0.5">
              Closed by <span className="text-ink-600 font-medium">{inst.closedBy}</span>
              {inst.closedAt && <span> · {formatIsraelTime(inst.closedAt)}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          {isAdmin && eff !== 'closed' && (
            <button
              onClick={() => setShowReassign(!showReassign)}
              className="px-2 py-1 text-xs text-ink-600 hover:bg-ink-100 rounded"
            >
              Reassign
            </button>
          )}
          {eff !== 'closed' ? (
            <button
              onClick={onClose}
              className={`px-3 py-1.5 text-white text-xs rounded transition flex items-center gap-1 ${
                eff === 'missed' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
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
      </div>

      {showReassign && isAdmin && (
        <div className="mt-2 pt-2 border-t border-ink-100 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-ink-400">Reassign to:</span>
          <select
            value={inst.personId || ''}
            onChange={(e) => {
              onReassign(e.target.value)
              setShowReassign(false)
            }}
            className="px-2 py-1 text-xs bg-white border border-ink-200 rounded"
          >
            <option value="">— unassigned —</option>
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowReassign(false)}
            className="text-xs text-ink-400 hover:text-ink-700"
          >
            Cancel
          </button>
        </div>
      )}
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
