import { useEffect, useMemo, useState } from 'react'
import {
  listScheduleTasks,
  listTabs,
  listTaskInstances,
  generateScheduledDates,
  todayDateString,
} from '../lib/db'

export default function ScheduleGridPage({ role }) {
  const isAdmin = role === 'admin'
  const [tasks, setTasks] = useState([])
  const [tabs, setTabs] = useState([])
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Date range — flexible
  const [dateFrom, setDateFrom] = useState(() => firstOfThisMonth())
  const [dateTo, setDateTo] = useState(() => lastOfThisMonth())

  async function refresh() {
    try {
      const [t, p, inst] = await Promise.all([
        listScheduleTasks(),
        listTabs(),
        listTaskInstances({ dateFrom, dateTo }),
      ])
      setTasks(t)
      setTabs(p)
      setInstances(inst)
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
  }, [dateFrom, dateTo])

  function shiftMonth(delta) {
    const d = new Date(dateFrom + 'T00:00:00')
    const y = d.getFullYear()
    const m = d.getMonth() + delta
    setDateFrom(formatDateInput(new Date(y, m, 1)))
    setDateTo(formatDateInput(new Date(y, m + 1, 0)))
  }

  function setRangeThisMonth() {
    setDateFrom(firstOfThisMonth())
    setDateTo(lastOfThisMonth())
  }

  function setRangeNextMonth() {
    const d = new Date()
    setDateFrom(formatDateInput(new Date(d.getFullYear(), d.getMonth() + 1, 1)))
    setDateTo(formatDateInput(new Date(d.getFullYear(), d.getMonth() + 2, 0)))
  }

  function setRangeThisWeek() {
    // Sunday-start week (Israel norm)
    const today = new Date()
    const wd = today.getDay() // 0=Sun
    const start = new Date(today)
    start.setDate(today.getDate() - wd)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    setDateFrom(formatDateInput(start))
    setDateTo(formatDateInput(end))
  }

  // Tasks shown in grid — only those marked showInGrid (default true) and active
  const gridTasks = useMemo(() => {
    return tasks.filter((t) => t.active && t.showInGrid !== false)
  }, [tasks])

  const tabsById = useMemo(() => {
    const m = {}
    tabs.forEach((t) => (m[t.id] = t))
    return m
  }, [tabs])

  // For each row date and each task column, figure out the assigned person.
  // Source priority: existing instance.personId (which reflects reassignments) >
  // template.assignments[date]. If the date isn't an eligible date for the task,
  // we render '—'.
  // Index instances by (templateId|date) for quick lookup.
  const instancesByKey = useMemo(() => {
    const m = new Map()
    for (const i of instances) {
      m.set(`${i.templateId}|${i.date}`, i)
    }
    return m
  }, [instances])

  // Generate the list of dates in the range
  const dates = useMemo(() => {
    const result = []
    if (!dateFrom || !dateTo) return result
    const start = new Date(dateFrom + 'T00:00:00')
    const end = new Date(dateTo + 'T00:00:00')
    if (end < start) return result
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(new Date(d))
    }
    return result
  }, [dateFrom, dateTo])

  function dateKey(dateObj) {
    const y = dateObj.getFullYear()
    const m = String(dateObj.getMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function cellInfoFor(task, dateObj) {
    const dStr = dateKey(dateObj)
    // Eligibility: must match cadence
    const eligibleDates = generateScheduledDates(task, dStr, dStr)
    if (eligibleDates.length === 0) {
      return { kind: 'na' }
    }
    // Priority: existing instance > template assignment
    const inst = instancesByKey.get(`${task.id}|${dStr}`)
    const personId = inst?.personId || task.assignments?.[dStr] || ''
    return { kind: 'cell', personId, status: inst?.status }
  }

  const today = todayDateString()

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-7xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
            Schedule Grid
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-2">Calendar overview</h1>
          <p className="text-ink-500 text-sm">
            See every scheduled task and who's assigned across a date range. Read-only — to change
            assignments, use the Schedule page.
          </p>
        </div>
      </header>

      <div className="px-10 py-6 max-w-7xl">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Range controls */}
        <div className="bg-white border border-ink-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest text-ink-400 font-medium">
              Range:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 text-sm bg-paper border border-ink-200 rounded font-mono"
            />
            <span className="text-ink-400 text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 text-sm bg-paper border border-ink-200 rounded font-mono"
            />
            <div className="flex gap-1 ml-2 flex-wrap">
              <button onClick={() => shiftMonth(-1)} className="px-2 py-1 text-xs bg-white border border-ink-200 rounded hover:border-ink-400">
                ← Prev month
              </button>
              <button onClick={() => shiftMonth(1)} className="px-2 py-1 text-xs bg-white border border-ink-200 rounded hover:border-ink-400">
                Next month →
              </button>
              <button onClick={setRangeThisWeek} className="px-2 py-1 text-xs bg-white border border-ink-200 rounded hover:border-ink-400">
                This week
              </button>
              <button onClick={setRangeThisMonth} className="px-2 py-1 text-xs bg-white border border-ink-200 rounded hover:border-ink-400">
                This month
              </button>
              <button onClick={setRangeNextMonth} className="px-2 py-1 text-xs bg-white border border-ink-200 rounded hover:border-ink-400">
                Next month
              </button>
            </div>
          </div>
        </div>

        <div className="text-sm text-ink-500 mb-3 tabular">
          {dates.length} day{dates.length === 1 ? '' : 's'} · {gridTasks.length} task{gridTasks.length === 1 ? '' : 's'}
          {isAdmin && (
            <span className="text-ink-400">
              {' '}· tip: in Schedule task editor you can hide a task from the grid
            </span>
          )}
        </div>

        {loading && <p className="text-ink-400 text-sm">Loading…</p>}

        {!loading && (gridTasks.length === 0 || dates.length === 0) ? (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">
              {gridTasks.length === 0
                ? 'No active scheduled tasks to display.'
                : 'Empty date range.'}
            </p>
          </div>
        ) : !loading ? (
          <div className="bg-white border border-ink-200 rounded-lg overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 bg-ink-50 z-10">
                <tr>
                  <th className="sticky left-0 bg-ink-50 border-b border-r border-ink-200 px-3 py-2 text-left font-medium text-[10px] uppercase tracking-widest text-ink-500 z-20 min-w-[120px]">
                    Date
                  </th>
                  {gridTasks.map((task) => (
                    <th
                      key={task.id}
                      className="border-b border-r border-ink-200 px-2 py-2 text-left align-bottom"
                      style={{ minWidth: '110px' }}
                    >
                      <div className="flex items-start gap-1.5">
                        <span
                          className="w-1 h-8 rounded-sm flex-shrink-0 mt-0.5"
                          style={{ background: task.color || '#c46a3a' }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-ink-900 leading-tight">
                            {task.name}
                          </div>
                          {task.deadlineTime && (
                            <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                              by {task.deadlineTime}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((dateObj) => {
                  const dStr = dateKey(dateObj)
                  const isToday = dStr === today
                  const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6
                  return (
                    <tr key={dStr} className={isToday ? 'bg-accent/5' : isWeekend ? 'bg-ink-50/40' : ''}>
                      <td
                        className={`sticky left-0 border-b border-r border-ink-100 px-3 py-1.5 align-middle z-10 ${
                          isToday ? 'bg-accent/10' : isWeekend ? 'bg-ink-50/80' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono tabular text-ink-700 text-xs">
                            {formatShortDate(dateObj)}
                          </span>
                          <span className="text-[10px] uppercase text-ink-400 tracking-wider">
                            {DAY_NAMES_SHORT[dateObj.getDay()]}
                          </span>
                          {isToday && (
                            <span className="text-[9px] uppercase tracking-widest text-accent font-bold">
                              today
                            </span>
                          )}
                        </div>
                      </td>
                      {gridTasks.map((task) => {
                        const info = cellInfoFor(task, dateObj)
                        if (info.kind === 'na') {
                          return (
                            <td
                              key={task.id}
                              className="border-b border-r border-ink-100 px-2 py-1.5 text-center text-ink-200"
                            >
                              ·
                            </td>
                          )
                        }
                        const person = tabsById[info.personId]
                        return (
                          <td
                            key={task.id}
                            className="border-b border-r border-ink-100 px-1.5 py-1 align-middle"
                          >
                            {person ? (
                              <div
                                className="text-[11px] px-1.5 py-0.5 rounded font-medium text-center truncate"
                                style={{
                                  background: person.color || '#c46a3a',
                                  color: getTextColor(person.color || '#c46a3a'),
                                  opacity: info.status === 'closed' ? 0.5 : 1,
                                }}
                                title={
                                  info.status === 'closed'
                                    ? `${person.name} · Done`
                                    : info.status === 'open'
                                    ? `${person.name} · Open`
                                    : person.name
                                }
                              >
                                {person.name}
                                {info.status === 'closed' && (
                                  <span className="ml-1">✓</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-700 italic text-center">
                                —
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Legend */}
        {!loading && gridTasks.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-ink-500">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-accent/10 border border-accent/30 inline-block" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-ink-50 border border-ink-200 inline-block" />
              <span>Weekend</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="opacity-50 px-1 rounded bg-ink-700 text-white">Name ✓</span>
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-amber-700 italic">—</span>
              <span>Unassigned</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-ink-300">·</span>
              <span>Not scheduled</span>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function firstOfThisMonth() {
  const d = new Date()
  return formatDateInput(new Date(d.getFullYear(), d.getMonth(), 1))
}
function lastOfThisMonth() {
  const d = new Date()
  return formatDateInput(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function formatDateInput(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatShortDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
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
