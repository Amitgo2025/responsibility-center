import { useEffect, useMemo, useState } from 'react'
import {
  listScheduleTasks,
  listTabs,
  listTaskInstances,
  listTags,
  listTagCategories,
  generateScheduledDates,
  todayDateString,
} from '../lib/db'

export default function ScheduleGridPage({ role }) {
  const isAdmin = role === 'admin'
  const [tasks, setTasks] = useState([])
  const [tabs, setTabs] = useState([])
  const [instances, setInstances] = useState([])
  const [tags, setTags] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Date range — flexible
  const [dateFrom, setDateFrom] = useState(() => firstOfThisMonth())
  const [dateTo, setDateTo] = useState(() => lastOfThisMonth())

  // Task filters (independent from the Schedule page filters)
  const [tagFilter, setTagFilter] = useState([]) // tag IDs
  const [cadenceFilter, setCadenceFilter] = useState('') // '' | 'daily' | 'weekly' | 'dates' | 'custom'
  const [search, setSearch] = useState('')
  const [hiddenTaskIds, setHiddenTaskIds] = useState([]) // explicitly hidden by user
  const [showTaskPicker, setShowTaskPicker] = useState(false)

  async function refresh() {
    try {
      const [t, p, inst, tg, c] = await Promise.all([
        listScheduleTasks(),
        listTabs(),
        listTaskInstances({ dateFrom, dateTo }),
        listTags(),
        listTagCategories(),
      ])
      setTasks(t)
      setTabs(p)
      setInstances(inst)
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

  // Tasks shown in grid — apply filters in this order:
  //   1. Active and showInGrid (admin's "show in grid" flag from task editor)
  //   2. Cadence filter
  //   3. Tag filter (OR within selection)
  //   4. Search by name/description
  //   5. Explicitly hidden by user via the picker
  const gridTasks = useMemo(() => {
    const lc = (search || '').trim().toLowerCase()
    return tasks.filter((t) => {
      if (!t.active || t.showInGrid === false) return false
      if (hiddenTaskIds.includes(t.id)) return false
      if (cadenceFilter && t.cadence !== cadenceFilter) return false
      if (tagFilter.length > 0) {
        const taskTags = t.tags || []
        if (!tagFilter.some((id) => taskTags.includes(id))) return false
      }
      if (lc) {
        const hay = [t.name || '', t.description || ''].join(' ').toLowerCase()
        if (!hay.includes(lc)) return false
      }
      return true
    })
  }, [tasks, cadenceFilter, tagFilter, search, hiddenTaskIds])

  // Total tasks eligible for the grid (active + showInGrid) — for the counter
  const eligibleTaskCount = useMemo(() => {
    return tasks.filter((t) => t.active && t.showInGrid !== false).length
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

        {/* Task filter bar */}
        <GridFilterBar
          allTasks={tasks}
          tags={tags}
          categories={categories}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          cadenceFilter={cadenceFilter}
          setCadenceFilter={setCadenceFilter}
          search={search}
          setSearch={setSearch}
          hiddenTaskIds={hiddenTaskIds}
          setHiddenTaskIds={setHiddenTaskIds}
          showTaskPicker={showTaskPicker}
          setShowTaskPicker={setShowTaskPicker}
        />

        <div className="text-sm text-ink-500 mb-3 tabular">
          {dates.length} day{dates.length === 1 ? '' : 's'} · {gridTasks.length} of {eligibleTaskCount} task{eligibleTaskCount === 1 ? '' : 's'}
          {gridTasks.length !== eligibleTaskCount && (
            <span className="text-ink-400"> · filtered</span>
          )}
          {isAdmin && (
            <span className="text-ink-400">
              {' '}· tip: in Schedule task editor you can hide a task from the grid permanently
            </span>
          )}
        </div>

        {loading && <p className="text-ink-400 text-sm">Loading…</p>}

        {!loading && (gridTasks.length === 0 || dates.length === 0) ? (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">
              {dates.length === 0
                ? 'Empty date range.'
                : eligibleTaskCount === 0
                ? 'No active scheduled tasks to display.'
                : 'No tasks match these filters.'}
            </p>
            {dates.length > 0 && eligibleTaskCount > 0 && gridTasks.length === 0 && (
              <button
                onClick={() => {
                  setTagFilter([])
                  setCadenceFilter('')
                  setSearch('')
                  setHiddenTaskIds([])
                }}
                className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
              >
                Clear filters
              </button>
            )}
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

// =================================================
// Filter bar for the grid
// =================================================
function GridFilterBar({
  allTasks, tags, categories,
  tagFilter, setTagFilter,
  cadenceFilter, setCadenceFilter,
  search, setSearch,
  hiddenTaskIds, setHiddenTaskIds,
  showTaskPicker, setShowTaskPicker,
}) {
  const tagsByCategory = useMemo(() => {
    return categories.map((cat) => ({
      category: cat,
      tags: tags.filter((t) => t.categoryId === cat.id),
    })).filter((g) => g.tags.length > 0)
  }, [tags, categories])

  // Tasks eligible for the picker — same rule as grid: active + showInGrid
  const eligibleTasks = useMemo(() => {
    return allTasks.filter((t) => t.active && t.showInGrid !== false)
  }, [allTasks])

  function toggleTag(tagId) {
    setTagFilter((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  function toggleHidden(taskId) {
    setHiddenTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId],
    )
  }

  function showAllTasks() {
    setHiddenTaskIds([])
  }

  function hideAllTasks() {
    setHiddenTaskIds(eligibleTasks.map((t) => t.id))
  }

  function clearAll() {
    setTagFilter([])
    setCadenceFilter('')
    setSearch('')
    setHiddenTaskIds([])
  }

  const hasFilters =
    tagFilter.length > 0 ||
    cadenceFilter ||
    (search || '').trim() ||
    hiddenTaskIds.length > 0

  return (
    <div className="bg-white border border-ink-200 rounded-lg p-4 mb-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search task name or description…"
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
          Cadence:
        </span>
        <CadencePill v="" current={cadenceFilter} onSelect={setCadenceFilter}>All</CadencePill>
        <CadencePill v="daily" current={cadenceFilter} onSelect={setCadenceFilter}>Daily</CadencePill>
        <CadencePill v="weekly" current={cadenceFilter} onSelect={setCadenceFilter}>Weekly</CadencePill>
        <CadencePill v="dates" current={cadenceFilter} onSelect={setCadenceFilter}>Dates</CadencePill>
        <CadencePill v="custom" current={cadenceFilter} onSelect={setCadenceFilter}>Custom</CadencePill>
        <button
          onClick={() => setShowTaskPicker(!showTaskPicker)}
          className={`px-2.5 py-1 text-xs rounded-full border transition ${
            showTaskPicker || hiddenTaskIds.length > 0
              ? 'bg-ink-900 text-white border-ink-900'
              : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
          }`}
        >
          {hiddenTaskIds.length > 0
            ? `Pick tasks (${eligibleTasks.length - hiddenTaskIds.length}/${eligibleTasks.length})`
            : 'Pick tasks'}
        </button>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-ink-500 hover:text-ink-900 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {tagsByCategory.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-ink-100">
          {tagsByCategory.map(({ category, tags: catTags }) => (
            <div key={category.id} className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium w-28 flex-shrink-0">
                {category.name}:
              </span>
              <div className="flex flex-wrap gap-1">
                {catTags.map((tag) => {
                  const sel = tagFilter.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                        sel
                          ? 'border-transparent shadow-sm'
                          : 'bg-white border-ink-200 text-ink-700 hover:border-ink-400'
                      }`}
                      style={
                        sel
                          ? {
                              background: tag.color,
                              color: getTextColor(tag.color),
                              borderColor: tag.color,
                            }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showTaskPicker && (
        <div className="pt-2 border-t border-ink-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
              Pick tasks to show:
            </span>
            <button
              onClick={showAllTasks}
              className="text-[11px] text-ink-600 hover:text-ink-900 underline"
            >
              Show all
            </button>
            <button
              onClick={hideAllTasks}
              className="text-[11px] text-ink-600 hover:text-ink-900 underline"
            >
              Hide all
            </button>
            <span className="text-[10px] text-ink-400 ml-auto">
              {eligibleTasks.length - hiddenTaskIds.length} of {eligibleTasks.length} shown
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-60 overflow-y-auto">
            {eligibleTasks.map((task) => {
              const hidden = hiddenTaskIds.includes(task.id)
              return (
                <label
                  key={task.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-ink-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => toggleHidden(task.id)}
                    className="accent-accent"
                  />
                  <span
                    className="w-1 h-4 rounded-sm flex-shrink-0"
                    style={{ background: task.color || '#c46a3a' }}
                  />
                  <span className={`text-xs ${hidden ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
                    {task.name}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CadencePill({ v, current, onSelect, children }) {
  const active = current === v
  return (
    <button
      onClick={() => onSelect(v)}
      className={`px-2.5 py-1 text-xs rounded-full border transition ${
        active
          ? 'bg-ink-900 text-white border-ink-900'
          : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
      }`}
    >
      {children}
    </button>
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
