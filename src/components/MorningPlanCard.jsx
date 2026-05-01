import { useEffect, useState, useMemo } from 'react'
import {
  PLAN_LANES,
  getDailyPlan,
  getOpenPlanForPerson,
  submitDailyPlan,
  closeDailyPlan,
  listTags,
  listTagCategories,
  todayDateString,
  formatIsraelTime,
} from '../lib/db'

function emptyLine() {
  return { lane: '', platforms: [], notes: '' }
}

export default function MorningPlanCard({ personId, person, currentUser, isOwner, isAdmin }) {
  const [today] = useState(() => todayDateString())
  const [todayPlan, setTodayPlan] = useState(null)
  const [openPriorPlan, setOpenPriorPlan] = useState(null)
  const [tags, setTags] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Form state for today's plan
  const [lines, setLines] = useState([emptyLine()])
  // Form state for closing yesterday's plan
  const [feedback, setFeedback] = useState('')

  async function refresh() {
    try {
      const [tp, op, t, c] = await Promise.all([
        getDailyPlan(personId, today),
        getOpenPlanForPerson(personId),
        listTags(),
        listTagCategories(),
      ])
      setTodayPlan(tp)
      // Only show "close yesterday's plan first" if the open plan is from a previous date
      setOpenPriorPlan(op && op.date < today ? op : null)
      setTags(t)
      setCategories(c)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setLines([emptyLine()])
    setFeedback('')
    setCollapsed(false)
    ;(async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, today])

  // Resolve the Platform tag category — used for the platform picker
  const platformCategory = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === 'platform')
  }, [categories])
  const platformTags = useMemo(() => {
    if (!platformCategory) return []
    return tags.filter((t) => t.categoryId === platformCategory.id)
  }, [tags, platformCategory])

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }
  function removeLine(idx) {
    setLines((prev) => prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== idx))
  }
  function togglePlatform(idx, tagId) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      const has = l.platforms.includes(tagId)
      return {
        ...l,
        platforms: has ? l.platforms.filter((x) => x !== tagId) : [...l.platforms, tagId],
      }
    }))
  }

  async function handleSubmitToday() {
    // Need at least one line with a lane filled
    const valid = lines.filter((l) => l.lane && l.lane.trim())
    if (valid.length === 0) {
      setError('Pick at least one lane to plan for today.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitDailyPlan({
        personId,
        date: today,
        lines: valid.map((l) => ({
          lane: l.lane,
          platforms: l.platforms,
          notes: (l.notes || '').trim(),
        })),
        submittedBy: currentUser?.displayName || '',
      })
      setLines([emptyLine()])
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseYesterday() {
    if (!openPriorPlan) return
    if (!feedback.trim()) {
      setError('Add at least a short feedback line about yesterday before closing.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await closeDailyPlan(
        openPriorPlan.id,
        feedback.trim(),
        currentUser?.displayName || '',
      )
      setFeedback('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  // ============== OBSERVER VIEW (not the owner) ==============
  // If you're viewing someone else's tab, show only the submitted plan if any exists.
  // No editing, no "needs feedback" prompts.
  if (!isOwner) {
    if (todayPlan) {
      return (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5 shadow-sm">
          <div className="flex items-baseline gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <h2 className="font-display text-xl text-ink-900">{person?.name || ''}'s plan today</h2>
            <span className="text-xs text-emerald-700">
              · {formatIsraelTime(todayPlan.submittedAt)}
            </span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto text-xs text-ink-500 hover:text-ink-900 underline"
            >
              {collapsed ? 'Show' : 'Collapse'}
            </button>
          </div>
          {!collapsed && (
            <div className="space-y-2">
              {todayPlan.lines.map((line, i) => (
                <PlanLineDisplay key={i} line={line} platformTags={platformTags} />
              ))}
            </div>
          )}
        </div>
      )
    }
    // No plan yet — observer sees nothing
    return null
  }

  // ============== OWNER VIEW: needs to close yesterday first ==============
  if (openPriorPlan) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 shadow-sm">
        <div className="flex items-baseline gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className="font-display text-xl text-ink-900">Close yesterday first</h2>
          <span className="text-xs text-amber-700 font-mono">· {openPriorPlan.date}</span>
        </div>
        <p className="text-sm text-ink-700 mb-3 leading-relaxed">
          Before you can plan today, share a short feedback on how yesterday went.
        </p>

        {/* Show what was planned yesterday for context */}
        <div className="bg-white border border-amber-200 rounded p-3 mb-3 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-400 font-medium mb-1">
            Yesterday's plan
          </div>
          {openPriorPlan.lines.map((line, i) => (
            <PlanLineDisplay key={i} line={line} platformTags={platformTags} />
          ))}
        </div>

        <label className="block">
          <span className="block text-[11px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
            How did yesterday go?
          </span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="What got done, what didn't, anything to flag…"
            className="w-full px-3 py-2 bg-white border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
        </label>

        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCloseYesterday}
          disabled={submitting || !feedback.trim()}
          className="mt-3 px-4 py-2 bg-ink-900 hover:bg-ink-800 text-ink-50 text-sm rounded transition disabled:opacity-40"
        >
          {submitting ? 'Saving…' : "Close yesterday's plan"}
        </button>
      </div>
    )
  }

  // ============== OWNER VIEW: today already submitted (read-only) ==============
  if (todayPlan) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5 shadow-sm">
        <div className="flex items-baseline gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <h2 className="font-display text-xl text-ink-900">Today's plan submitted</h2>
          <span className="text-xs text-emerald-700">
            · sent at {formatIsraelTime(todayPlan.submittedAt)}
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-xs text-ink-500 hover:text-ink-900 underline"
          >
            {collapsed ? 'Show' : 'Collapse'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            {todayPlan.lines.map((line, i) => (
              <PlanLineDisplay key={i} line={line} platformTags={platformTags} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============== OWNER VIEW: ready to submit today's plan ==============
  return (
    <div className="bg-gradient-to-br from-accent/5 to-amber-50/40 border-2 border-accent/30 rounded-lg p-5 shadow-sm">
      <div className="flex items-baseline gap-2 mb-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c46a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
        <h2 className="font-display text-xl text-ink-900">Plan your day</h2>
        <span className="text-xs text-ink-500 font-mono">· {today}</span>
      </div>
      <p className="text-sm text-ink-500 mb-4">
        What lanes are you working on today? Add platforms and a short note for context.
      </p>

      <div className="space-y-3">
        {lines.map((line, idx) => (
          <PlanLineEditor
            key={idx}
            line={line}
            platformTags={platformTags}
            onChange={(patch) => updateLine(idx, patch)}
            onTogglePlatform={(tagId) => togglePlatform(idx, tagId)}
            onRemove={() => removeLine(idx)}
            canRemove={lines.length > 1}
            index={idx}
          />
        ))}
      </div>

      <button
        onClick={addLine}
        className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
      >
        + Add another lane
      </button>

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-ink-200/60">
        <button
          onClick={handleSubmitToday}
          disabled={submitting}
          className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm rounded transition disabled:opacity-40"
        >
          {submitting ? 'Sending…' : 'Submit today\u2019s plan'}
        </button>
        <span className="ml-3 text-xs text-ink-400">
          Once submitted, you can\u2019t edit it. Tomorrow you\u2019ll be asked to close it with feedback.
        </span>
      </div>
    </div>
  )
}

// ===== Edit row =====
function PlanLineEditor({ line, platformTags, onChange, onTogglePlatform, onRemove, canRemove, index }) {
  return (
    <div className="bg-white border border-ink-200 rounded p-3">
      <div className="flex items-start gap-2">
        <span className="text-[10px] uppercase tracking-widest text-ink-300 font-mono mt-2 w-6 tabular">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={line.lane}
              onChange={(e) => onChange({ lane: e.target.value })}
              className="px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">— pick lane —</option>
              {PLAN_LANES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {canRemove && (
              <button
                onClick={onRemove}
                className="ml-auto text-xs text-ink-400 hover:text-red-600"
                aria-label="Remove line"
              >
                Remove
              </button>
            )}
          </div>

          {platformTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] uppercase tracking-widest text-ink-400 self-center mr-1">
                Platforms:
              </span>
              {platformTags.map((tag) => {
                const sel = line.platforms.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => onTogglePlatform(tag.id)}
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
          )}

          <textarea
            value={line.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            placeholder="Free text — what you\u2019re focusing on, ideas, blockers…"
            className="w-full px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
        </div>
      </div>
    </div>
  )
}

// ===== Display row (read-only) =====
function PlanLineDisplay({ line, platformTags }) {
  const platforms = (line.platforms || [])
    .map((id) => platformTags.find((t) => t.id === id))
    .filter(Boolean)
  return (
    <div className="border-l-2 border-accent/40 pl-3 py-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-ink-900">{line.lane}</span>
        {platforms.map((tag) => (
          <span
            key={tag.id}
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: tag.color, color: getTextColor(tag.color) }}
          >
            {tag.name}
          </span>
        ))}
      </div>
      {line.notes && (
        <p className="text-sm text-ink-600 mt-0.5 leading-relaxed whitespace-pre-wrap">
          {line.notes}
        </p>
      )}
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
