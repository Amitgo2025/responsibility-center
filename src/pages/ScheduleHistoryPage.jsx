import { useEffect, useMemo, useState } from 'react'
import {
  listTaskInstances,
  listScheduleTasks,
  listTabs,
  listDailyPlans,
  listTags,
  listTagCategories,
  reassignTaskInstance,
  effectiveStatus,
  formatIsraelTime,
  todayDateString,
} from '../lib/db'

export default function ScheduleHistoryPage({ role }) {
  const [view, setView] = useState('tasks') // 'tasks' | 'plans'

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-6xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
            History
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-2">Performance log</h1>
          <p className="text-ink-500 text-sm">
            Schedule tasks and morning plans — what happened, when, by whom.
          </p>
        </div>
        <div className="px-10 max-w-6xl flex gap-1">
          <ViewTab active={view === 'tasks'} onClick={() => setView('tasks')}>
            Schedule tasks
          </ViewTab>
          <ViewTab active={view === 'plans'} onClick={() => setView('plans')}>
            Daily plans
          </ViewTab>
        </div>
      </header>

      {view === 'tasks' ? (
        <TaskInstancesView role={role} />
      ) : (
        <DailyPlansView role={role} />
      )}
    </main>
  )
}

function ViewTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-accent text-ink-900'
          : 'border-transparent text-ink-400 hover:text-ink-700'
      }`}
    >
      {children}
    </button>
  )
}

function TaskInstancesView({ role }) {
  const isAdmin = role === 'admin'
  const [instances, setInstances] = useState([])
  const [templates, setTemplates] = useState([])
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Default range: last 30 days, ending today
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return formatDateInput(d)
  })
  const [dateTo, setDateTo] = useState(() => formatDateInput(new Date()))

  const [statusFilter, setStatusFilter] = useState('all') // all | done | missed | open
  const [personFilter, setPersonFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  const [search, setSearch] = useState('')

  async function refresh() {
    try {
      const [inst, tpl, t] = await Promise.all([
        listTaskInstances({ dateFrom, dateTo }),
        listScheduleTasks(),
        listTabs(),
      ])
      setInstances(inst)
      setTemplates(tpl)
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
  }, [dateFrom, dateTo])

  const tabsById = useMemo(() => {
    const m = {}
    tabs.forEach((t) => (m[t.id] = t))
    return m
  }, [tabs])

  const now = new Date()

  const enriched = useMemo(() => {
    return instances.map((inst) => ({
      ...inst,
      _eff: effectiveStatus(inst, now),
      _person: tabsById[inst.personId],
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, tabsById])

  const filtered = useMemo(() => {
    const lc = search.trim().toLowerCase()
    return enriched.filter((i) => {
      if (personFilter && i.personId !== personFilter) return false
      if (taskFilter && i.templateId !== taskFilter) return false
      if (statusFilter !== 'all') {
        if (statusFilter === 'done' && i._eff !== 'closed') return false
        if (statusFilter === 'missed' && i._eff !== 'missed') return false
        if (statusFilter === 'open' && i._eff !== 'open') return false
      }
      if (lc) {
        const hay = [i.name, i.closedBy || '', i._person?.name || ''].join(' ').toLowerCase()
        if (!hay.includes(lc)) return false
      }
      return true
    })
  }, [enriched, search, personFilter, taskFilter, statusFilter])

  // Sort: most recent first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Order by date desc, then by closedAt desc, then by name
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      const at = a.closedAt || a.deadline || a.createdAt || ''
      const bt = b.closedAt || b.deadline || b.createdAt || ''
      return bt.localeCompare(at)
    })
  }, [filtered])

  // Quick stats
  const stats = useMemo(() => {
    const total = filtered.length
    let done = 0
    let missed = 0
    let open = 0
    for (const i of filtered) {
      if (i._eff === 'closed') done++
      else if (i._eff === 'missed') missed++
      else open++
    }
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, missed, open, completionRate }
  }, [filtered])

  function clearFilters() {
    setStatusFilter('all')
    setPersonFilter('')
    setTaskFilter('')
    setSearch('')
  }

  function setRange(days) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateFrom(formatDateInput(start))
    setDateTo(formatDateInput(end))
  }

  function setRangeThisMonth() {
    const d = new Date()
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    setDateFrom(formatDateInput(first))
    setDateTo(formatDateInput(d))
  }

  async function handleReassign(inst, newPersonId) {
    try {
      await reassignTaskInstance(inst.id, newPersonId)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="px-10 py-6 max-w-6xl">
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total" value={stats.total} tone="ink" />
          <StatCard label="Done" value={stats.done} tone="emerald" extra={`${stats.completionRate}%`} />
          <StatCard label="Missed" value={stats.missed} tone="red" />
          <StatCard label="Still open" value={stats.open} tone="amber" />
        </div>

        {/* Date range + filters */}
        <div className="bg-white border border-ink-200 rounded-lg p-4 mb-4 space-y-3">
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
            <div className="flex gap-1 ml-2">
              <RangePill onClick={() => setRange(7)}>7d</RangePill>
              <RangePill onClick={() => setRange(30)}>30d</RangePill>
              <RangePill onClick={() => setRange(90)}>90d</RangePill>
              <RangePill onClick={setRangeThisMonth}>This month</RangePill>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statusFilter === 'all'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statusFilter === 'done'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              Done
            </button>
            <button
              onClick={() => setStatusFilter('missed')}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statusFilter === 'missed'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              Missed
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statusFilter === 'open'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
              }`}
            >
              Still open
            </button>

            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="ml-auto px-2 py-1.5 text-xs bg-white border border-ink-200 rounded"
            >
              <option value="">All people</option>
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-white border border-ink-200 rounded"
            >
              <option value="">All tasks</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {(statusFilter !== 'all' || personFilter || taskFilter || search) && (
              <button
                onClick={clearFilters}
                className="text-xs text-ink-500 hover:text-ink-900 underline"
              >
                Clear
              </button>
            )}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task name, person, or who closed…"
            className="w-full px-3 py-2 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="text-sm text-ink-500 mb-3 tabular">
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
        </div>

        {loading && <p className="text-ink-400 text-sm">Loading…</p>}
        {!loading && sorted.length === 0 && (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No entries match these filters.</p>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="bg-white border border-ink-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-200 text-left">
                <tr className="text-[10px] uppercase tracking-widest text-ink-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className="px-3 py-2 font-medium">Assigned</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Deadline</th>
                  <th className="px-3 py-2 font-medium">Closed by</th>
                  <th className="px-3 py-2 font-medium">Closed at</th>
                  {isAdmin && <th className="px-3 py-2 font-medium">Admin</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((inst) => (
                  <HistoryRow
                    key={inst.id}
                    inst={inst}
                    tabs={tabs}
                    isAdmin={isAdmin}
                    onReassign={(newId) => handleReassign(inst, newId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// =================================================
// Daily Plans History View
// =================================================
function DailyPlansView({ role }) {
  const [plans, setPlans] = useState([])
  const [tabs, setTabs] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Default range: last 14 days
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return formatDateInput(d)
  })
  const [dateTo, setDateTo] = useState(() => formatDateInput(new Date()))

  const [statusFilter, setStatusFilter] = useState('all') // all | submitted | closed
  const [personFilter, setPersonFilter] = useState('')
  const [search, setSearch] = useState('')

  async function refresh() {
    try {
      const [p, t, tg] = await Promise.all([
        listDailyPlans({ dateFrom, dateTo }),
        listTabs(),
        listTags(),
      ])
      setPlans(p)
      setTabs(t)
      setTags(tg)
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

  const tabsById = useMemo(() => {
    const m = {}
    tabs.forEach((t) => (m[t.id] = t))
    return m
  }, [tabs])

  const tagsById = useMemo(() => {
    const m = {}
    tags.forEach((t) => (m[t.id] = t))
    return m
  }, [tags])

  const filtered = useMemo(() => {
    const lc = search.trim().toLowerCase()
    return plans.filter((p) => {
      if (personFilter && p.personId !== personFilter) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (lc) {
        const lanes = (p.lines || []).map((l) => l.lane || '').join(' ')
        const notes = (p.lines || []).map((l) => l.notes || '').join(' ')
        const personName = tabsById[p.personId]?.name || ''
        const hay = [lanes, notes, personName, p.feedback || ''].join(' ').toLowerCase()
        if (!hay.includes(lc)) return false
      }
      return true
    })
  }, [plans, search, personFilter, statusFilter, tabsById])

  // Sort: most recent first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      const at = a.submittedAt || a.createdAt || ''
      const bt = b.submittedAt || b.createdAt || ''
      return bt.localeCompare(at)
    })
  }, [filtered])

  const stats = useMemo(() => {
    const total = filtered.length
    const closed = filtered.filter((p) => p.status === 'closed').length
    const submitted = filtered.filter((p) => p.status === 'submitted').length
    return { total, closed, submitted }
  }, [filtered])

  function setRange(days) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDateFrom(formatDateInput(start))
    setDateTo(formatDateInput(end))
  }

  function clearFilters() {
    setStatusFilter('all')
    setPersonFilter('')
    setSearch('')
  }

  return (
    <div className="px-10 py-6 max-w-6xl">
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total" value={stats.total} tone="ink" />
        <StatCard label="Closed (with feedback)" value={stats.closed} tone="emerald" />
        <StatCard label="Submitted, not closed" value={stats.submitted} tone="amber" />
      </div>

      <div className="bg-white border border-ink-200 rounded-lg p-4 mb-4 space-y-3">
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
          <div className="flex gap-1 ml-2">
            <RangePill onClick={() => setRange(7)}>7d</RangePill>
            <RangePill onClick={() => setRange(14)}>14d</RangePill>
            <RangePill onClick={() => setRange(30)}>30d</RangePill>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              statusFilter === 'all'
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              statusFilter === 'closed'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
            }`}
          >
            Closed
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              statusFilter === 'submitted'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
            }`}
          >
            Submitted, no feedback yet
          </button>

          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="ml-auto px-2 py-1.5 text-xs bg-white border border-ink-200 rounded"
          >
            <option value="">All people</option>
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {(statusFilter !== 'all' || personFilter || search) && (
            <button
              onClick={clearFilters}
              className="text-xs text-ink-500 hover:text-ink-900 underline"
            >
              Clear
            </button>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lane, notes, person, feedback…"
          className="w-full px-3 py-2 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="text-sm text-ink-500 mb-3 tabular">
        {sorted.length} {sorted.length === 1 ? 'plan' : 'plans'}
      </div>

      {loading && <p className="text-ink-400 text-sm">Loading…</p>}
      {!loading && sorted.length === 0 && (
        <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
          <p className="text-ink-400">No plans match these filters.</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((plan) => (
          <PlanHistoryCard
            key={plan.id}
            plan={plan}
            person={tabsById[plan.personId]}
            tagsById={tagsById}
          />
        ))}
      </div>
    </div>
  )
}

function PlanHistoryCard({ plan, person, tagsById }) {
  const [collapsed, setCollapsed] = useState(true)
  const isClosed = plan.status === 'closed'

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        isClosed ? 'border-emerald-200' : 'border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3 flex-wrap">
        {person && (
          <span
            className="px-2 py-0.5 text-xs font-medium rounded"
            style={{
              background: person.color || '#c46a3a',
              color: getTextColor(person.color || '#c46a3a'),
            }}
          >
            {person.name}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink-900 tabular">
              {formatHumanDate(plan.date)}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                isClosed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isClosed ? 'Closed' : 'Submitted'}
            </span>
            <span className="text-[11px] text-ink-400 font-mono">
              · {(plan.lines || []).length} line{(plan.lines || []).length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            Sent {plan.submittedAt ? formatIsraelTime(plan.submittedAt) : '—'}
            {isClosed && plan.closedAt && (
              <span> · Closed {formatIsraelTime(plan.closedAt)}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-ink-500 hover:text-ink-900 underline"
        >
          {collapsed ? 'Show details' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
          {(plan.lines || []).map((line, i) => (
            <div key={i} className="border-l-2 border-accent/40 pl-3 py-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-ink-900">{line.lane}</span>
                {(line.platforms || []).map((tagId) => {
                  const tag = tagsById[tagId]
                  if (!tag) return null
                  return (
                    <span
                      key={tagId}
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: tag.color, color: getTextColor(tag.color) }}
                    >
                      {tag.name}
                    </span>
                  )
                })}
              </div>
              {line.notes && (
                <p className="text-sm text-ink-600 mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {line.notes}
                </p>
              )}
            </div>
          ))}

          {isClosed && plan.feedback && (
            <div className="mt-3 pt-3 border-t border-emerald-100">
              <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-medium mb-1">
                End-of-day feedback
              </div>
              <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
                {plan.feedback}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryRow({ inst, tabs, isAdmin, onReassign }) {
  const eff = inst._eff
  const person = inst._person
  const [reassigning, setReassigning] = useState(false)

  const statusBadge =
    eff === 'closed'
      ? { text: 'Done', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
      : eff === 'missed'
      ? { text: 'Missed', tone: 'bg-red-100 text-red-700 border-red-200' }
      : { text: 'Open', tone: 'bg-amber-100 text-amber-800 border-amber-200' }

  return (
    <tr className={`border-b border-ink-100 last:border-0 ${eff === 'missed' ? 'bg-red-50/40' : ''}`}>
      <td className="px-3 py-2.5 align-top tabular text-ink-700 whitespace-nowrap">
        {formatHumanDate(inst.date)}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-sm flex-shrink-0" style={{ background: inst.color || '#c46a3a' }} />
          <span className="font-medium text-ink-900">{inst.name}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        {reassigning ? (
          <div className="flex items-center gap-1">
            <select
              defaultValue={inst.personId || ''}
              onChange={(e) => {
                onReassign(e.target.value)
                setReassigning(false)
              }}
              className="px-2 py-0.5 text-xs bg-white border border-ink-200 rounded"
            >
              <option value="">— unassigned —</option>
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button onClick={() => setReassigning(false)} className="text-[10px] text-ink-400">×</button>
          </div>
        ) : person ? (
          <span
            className="px-2 py-0.5 text-xs font-medium rounded"
            style={{
              background: person.color || '#c46a3a',
              color: getTextColor(person.color || '#c46a3a'),
            }}
          >
            {person.name}
          </span>
        ) : (
          <span className="text-xs text-amber-700 italic">unassigned</span>
        )}
        {inst.reassignedAt && (
          <div className="text-[10px] text-ink-400 mt-0.5">
            Reassigned · {formatIsraelTime(inst.reassignedAt)}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${statusBadge.tone}`}>
          {statusBadge.text}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top tabular text-ink-600 text-xs">
        {inst.deadlineTime || <span className="text-ink-300">—</span>}
      </td>
      <td className="px-3 py-2.5 align-top text-ink-700">
        {inst.closedBy ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{inst.closedBy}</span>
            {inst.closedDevice && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-ink-100 text-ink-600 rounded"
                title={`Closed from ${inst.closedDevice}`}
              >
                <DeviceIcon kind={inst.closedDevice} />
                {inst.closedDevice}
              </span>
            )}
          </div>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top tabular text-xs text-ink-600 whitespace-nowrap">
        {inst.closedAt ? formatIsraelTime(inst.closedAt) : <span className="text-ink-300">—</span>}
      </td>
      {isAdmin && (
        <td className="px-3 py-2.5 align-top">
          <button
            onClick={() => setReassigning(!reassigning)}
            className="text-[11px] text-ink-500 hover:text-ink-900 underline"
          >
            Reassign
          </button>
        </td>
      )}
    </tr>
  )
}

function StatCard({ label, value, tone, extra }) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : tone === 'red'
      ? 'bg-red-50 border-red-200 text-red-900'
      : tone === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-white border-ink-200 text-ink-900'
  return (
    <div className={`border rounded-lg p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70 font-medium mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl tabular">{value}</span>
        {extra && <span className="text-xs opacity-70">{extra}</span>}
      </div>
    </div>
  )
}

function RangePill({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-[11px] rounded border border-ink-200 bg-white text-ink-700 hover:border-ink-400"
    >
      {children}
    </button>
  )
}

function formatDateInput(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatHumanDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = todayDateString()
  const yesterday = (() => {
    const t = new Date()
    t.setDate(t.getDate() - 1)
    return formatDateInput(t)
  })()
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DeviceIcon({ kind }) {
  if (kind === 'Mobile') {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    )
  }
  if (kind === 'Tablet') {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    )
  }
  // Desktop
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
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
