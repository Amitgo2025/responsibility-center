import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listAllResponsibilities,
  listTabs,
  listTags,
  listTagCategories,
  listAllNotes,
} from '../lib/db'
import TagChip from '../components/TagChip'
import TodayScheduleBanner from '../components/TodayScheduleBanner'
import DailyUpdateBanner from '../components/DailyUpdateBanner'

const STATUS_LABELS = {
  active: { label: 'Active', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  review: { label: 'Under Review', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  transitioning: { label: 'Transitioning', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
}

export default function AllResponsibilitiesPage({ role, currentUser }) {
  const navigate = useNavigate()
  const [responsibilities, setResponsibilities] = useState([])
  const [tabs, setTabs] = useState([])
  const [tags, setTags] = useState([])
  const [categories, setCategories] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [personFilter, setPersonFilter] = useState('') // person id or ''
  const [sectionFilter, setSectionFilter] = useState('') // 'media' | 'other' | ''
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState([]) // array of tag ids; OR within a category, AND across categories
  const [groupBy, setGroupBy] = useState('person') // 'person' | 'section' | 'none'

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [r, t, tg, c, n] = await Promise.all([
          listAllResponsibilities(),
          listTabs(),
          listTags(),
          listTagCategories(),
          listAllNotes(),
        ])
        if (!active) return
        setResponsibilities(r)
        setTabs(t)
        setTags(tg)
        setCategories(c)
        setNotes(n)
        setLoading(false)
      } catch (err) {
        if (active) {
          setError(err.message)
          setLoading(false)
        }
      }
    })()
    return () => { active = false }
  }, [])

  function toggleTag(tagId) {
    setTagFilter((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  function clearAll() {
    setSearch('')
    setPersonFilter('')
    setSectionFilter('')
    setStatusFilter('')
    setTagFilter([])
  }

  const personById = useMemo(() => {
    const map = {}
    tabs.forEach((t) => (map[t.id] = t))
    return map
  }, [tabs])

  const tagById = useMemo(() => {
    const map = {}
    tags.forEach((t) => (map[t.id] = t))
    return map
  }, [tags])

  const filtered = useMemo(() => {
    const lc = search.trim().toLowerCase()
    return responsibilities.filter((r) => {
      if (personFilter && r.personId !== personFilter) return false
      if (sectionFilter && r.section !== sectionFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (tagFilter.length) {
        // AND-across-categories, OR-within-category
        // Group selected tags by category
        const selectedByCat = {}
        for (const id of tagFilter) {
          const t = tagById[id]
          if (!t) continue
          if (!selectedByCat[t.categoryId]) selectedByCat[t.categoryId] = []
          selectedByCat[t.categoryId].push(id)
        }
        const respTags = r.tags || []
        const passes = Object.values(selectedByCat).every((idsInCat) =>
          idsInCat.some((id) => respTags.includes(id)),
        )
        if (!passes) return false
      }
      if (lc) {
        const hay = [
          r.title || '',
          r.description || '',
          personById[r.personId]?.name || '',
          ...(r.tags || []).map((id) => tagById[id]?.name || ''),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(lc)) return false
      }
      return true
    })
  }, [responsibilities, search, personFilter, sectionFilter, statusFilter, tagFilter, personById, tagById])

  const grouped = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', items: filtered }]
    }
    if (groupBy === 'section') {
      const media = filtered.filter((r) => r.section === 'media')
      const other = filtered.filter((r) => r.section === 'other')
      return [
        ...(media.length ? [{ key: 'media', label: 'Media Buying Tasks', items: media }] : []),
        ...(other.length ? [{ key: 'other', label: 'Other Responsibilities', items: other }] : []),
      ]
    }
    // group by person
    const groups = {}
    for (const r of filtered) {
      if (!groups[r.personId]) groups[r.personId] = []
      groups[r.personId].push(r)
    }
    return tabs
      .filter((t) => groups[t.id])
      .map((t) => ({ key: t.id, label: t.name, color: t.color, role: t.role, items: groups[t.id] }))
  }, [filtered, groupBy, tabs])

  function noteCountFor(respId) {
    return notes.filter((n) => n.responsibilityId === respId).length
  }
  function openNoteCountFor(respId) {
    return notes.filter((n) => n.responsibilityId === respId && n.status === 'open').length
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center bg-paper p-8">
        <p className="text-ink-700">{error}</p>
      </main>
    )
  }

  const tagsByCategory = categories.map((c) => ({
    category: c,
    tags: tags.filter((t) => t.categoryId === c.id),
  }))

  const hasFilters = search || personFilter || sectionFilter || statusFilter || tagFilter.length > 0

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-6xl">
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
            All Responsibilities
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-2">Search across the team</h1>
          <p className="text-ink-500 text-sm">
            Find any responsibility by person, section, status, or tag. Use the filters to narrow
            down — for example, "who handles Google compliance" → tap Google + Compliance.
          </p>
        </div>
      </header>

      <div className="px-10 py-6 max-w-6xl">
        {/* Daily update from admin — visible to all */}
        <div className="mb-3">
          <DailyUpdateBanner role={role} currentUser={currentUser} />
        </div>

        {/* Today's schedule — prominent banner */}
        <div className="mb-5">
          <TodayScheduleBanner currentUser={currentUser} role={role} />
        </div>

        {/* Search bar */}
        <div className="bg-white border border-ink-200 rounded-lg p-5 mb-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, description, person, tag…"
                className="w-full pl-10 pr-3 py-2.5 bg-paper border border-ink-200 rounded text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearAll}
                className="px-3 py-2 text-sm text-ink-500 hover:text-ink-900 border border-ink-200 rounded hover:border-ink-400 transition"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Filter rows */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink-400 mb-1 font-medium">
                Person
              </label>
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Anyone</option>
                {tabs.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink-400 mb-1 font-medium">
                Section
              </label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Any</option>
                <option value="media">Media Buying Tasks</option>
                <option value="other">Other Responsibilities</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink-400 mb-1 font-medium">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="review">Under Review</option>
                <option value="transitioning">Transitioning</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-ink-400 mb-1 font-medium">
                Group by
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full px-2 py-1.5 bg-paper border border-ink-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="person">Person</option>
                <option value="section">Section</option>
                <option value="none">No grouping</option>
              </select>
            </div>
          </div>

          {/* Tag filter */}
          {tagsByCategory.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-2 font-medium">
                Tags <span className="normal-case text-ink-300">(within a category: any · across categories: all)</span>
              </div>
              <div className="space-y-2">
                {tagsByCategory.map(({ category, tags: catTags }) => {
                  if (catTags.length === 0) return null
                  return (
                    <div key={category.id} className="flex items-baseline gap-3">
                      <span className="text-xs text-ink-500 font-medium w-20 flex-shrink-0">
                        {category.name}:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
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
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-ink-500 mb-4 tabular">
          {filtered.length} result{filtered.length === 1 ? '' : 's'}{' '}
          {hasFilters && <span className="text-ink-400">· filters applied</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No responsibilities match these filters.</p>
            {hasFilters && (
              <button
                onClick={clearAll}
                className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.key}>
                {group.label && (
                  <div className="flex items-baseline gap-3 mb-3 pb-2 border-b border-ink-200">
                    {group.color && (
                      <span
                        className="w-2 h-6 rounded-sm flex-shrink-0"
                        style={{ background: group.color }}
                      />
                    )}
                    <h2 className="font-display text-2xl text-ink-900">{group.label}</h2>
                    {group.role && (
                      <span className="text-xs text-ink-500 italic">{group.role}</span>
                    )}
                    <span className="ml-auto text-xs text-ink-400 tabular">
                      {group.items.length}
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto bg-white border border-ink-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50 border-b border-ink-200">
                      <tr className="text-left text-[10px] uppercase tracking-widest text-ink-500">
                        {groupBy !== 'person' && <th className="px-3 py-2 font-medium">Person</th>}
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Tags</th>
                        <th className="px-3 py-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((r) => {
                        const person = personById[r.personId]
                        const respTags = (r.tags || [])
                          .map((id) => tagById[id])
                          .filter(Boolean)
                        const nc = noteCountFor(r.id)
                        const onc = openNoteCountFor(r.id)
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 cursor-pointer"
                            onClick={() => navigate(`/tab/${r.personId}`)}
                          >
                            {groupBy !== 'person' && (
                              <td className="px-3 py-2.5 align-top">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-1.5 h-4 rounded-sm flex-shrink-0"
                                    style={{ background: person?.color || '#c46a3a' }}
                                  />
                                  <span className="font-medium text-ink-900 whitespace-nowrap">
                                    {person?.name || r.personId}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="px-3 py-2.5 align-top">
                              <div className="font-medium text-ink-900">{r.title}</div>
                              {r.description && (
                                <div className="text-xs text-ink-500 mt-1 line-clamp-2 max-w-md">
                                  {r.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <span className="text-xs text-ink-600 whitespace-nowrap">
                                {r.section === 'media' ? 'Media Buying' : 'Other'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              {r.status && STATUS_LABELS[r.status] && (
                                <span
                                  className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border whitespace-nowrap ${STATUS_LABELS[r.status].tone}`}
                                >
                                  {STATUS_LABELS[r.status].label}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {respTags.map((tag) => (
                                  <TagChip
                                    key={tag.id}
                                    tag={tag}
                                    category={categories.find((c) => c.id === tag.categoryId)}
                                    size="xs"
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              {nc > 0 ? (
                                <span className="text-xs text-ink-700 tabular">
                                  {nc}
                                  {onc > 0 && (
                                    <span className="ml-1 text-accent font-bold">({onc} open)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-ink-300">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
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
