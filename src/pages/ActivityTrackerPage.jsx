import { useEffect, useMemo, useState } from 'react'

// ============================================================
// CONFIGURATION
// ============================================================
const SHEET_ID = '1fSM0LTEY6I6XQlsG-Oz4Usbwg-uSFVHJQbyln1gDnoI'
const SHEET_NAME = 'DB'
const RANGE = 'A1:W'

// Column index mapping (0-based)
const COL = {
  CREATION_DATE: 0, // A
  FLOW: 1,          // B (forced header — user wants 'Flow' even if sheet header is empty)
  COUNTRY: 2,       // C
  VERTICAL: 3,      // D
  WEBSITE_URL: 4,   // E
  CAMPAIGN_NAME: 5, // F
  WHO: 6,           // G
  TYPE: 7,          // H
}

const ALWAYS_VISIBLE_COLS = [0, 1, 2, 3, 4, 5, 6, 7] // A-H
const GENERAL_COLS = [8, 9, 10, 11, 12, 13]          // I-N (totals)
const DAY1_COLS = [14, 15, 16, 17, 18, 19, 20]       // O-U (1st day)
const LATE_COLS = [21, 22]                            // V-W (7 & 14 day)

// "Contains" filter applies to these columns
const CONTAINS_FILTER_COLS = [0, 1, 2, 3, 4, 5, 6, 7] // A-H

// Column header overrides (when sheet header is missing or unwanted)
const HEADER_OVERRIDES = {
  1: 'Flow', // B is always 'Flow'
}

const NUMERIC_COLS = new Set([
  ...GENERAL_COLS,
  // O is "1st Day Date" — text/date, not summed. Skip in numeric set.
  15, 16, 17, 18, 19, 20, // P-U numeric day1
  ...LATE_COLS,
])

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ActivityTrackerPage({ role }) {
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetchedAt, setLastFetchedAt] = useState(null)

  // View toggles — multi-select
  const [showGeneral, setShowGeneral] = useState(true)
  const [showDay1, setShowDay1] = useState(false)
  const [showLate, setShowLate] = useState(true)

  // Per-column "contains" filters for A-H
  const [containsFilters, setContainsFilters] = useState({}) // { [colIdx]: 'text' }

  // Date range filter (DD/MM — assume current year)
  const [dateFrom, setDateFrom] = useState('') // 'DD/MM'
  const [dateTo, setDateTo] = useState('')     // 'DD/MM'

  // Pagination — limits how many rows render in the table.
  // Sums and breakdowns still operate on the full filtered set.
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  async function loadSheet() {
    setLoading(true)
    setError('')
    try {
      const url =
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?` +
        `tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=${RANGE}` +
        `&_=${Date.now()}` // cache-buster
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Sheet fetch failed: ${res.status}`)
      }
      const text = await res.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('Sheet returned no rows.')
      }
      // First row = headers
      const headerRow = parsed[0].map((h, i) => HEADER_OVERRIDES[i] || h || '')
      const dataRows = parsed.slice(1).filter((r) => r.some((c) => (c || '').trim()))
      setHeaders(headerRow)
      setRows(dataRows)
      setLastFetchedAt(new Date().toISOString())
    } catch (err) {
      setError(`Could not load sheet: ${err.message}. Check that the sheet is shared with "Anyone with the link" and that the tab "${SHEET_NAME}" exists.`)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load on mount
  useEffect(() => {
    loadSheet()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply filters to rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Contains filters (case-insensitive)
      for (const [colIdxStr, term] of Object.entries(containsFilters)) {
        if (!term || !term.trim()) continue
        const idx = parseInt(colIdxStr, 10)
        const cell = (r[idx] || '').toString().toLowerCase()
        if (!cell.includes(term.toLowerCase().trim())) return false
      }
      // Date range
      if (dateFrom || dateTo) {
        const cellDate = parseDDMM(r[COL.CREATION_DATE])
        if (!cellDate) return false
        if (dateFrom) {
          const fromDate = parseDDMM(dateFrom)
          if (fromDate && cellDate < fromDate) return false
        }
        if (dateTo) {
          const toDate = parseDDMM(dateTo)
          if (toDate && cellDate > toDate) return false
        }
      }
      return true
    })
  }, [rows, containsFilters, dateFrom, dateTo])

  // Reset to page 1 whenever filters or page size change so the user always
  // sees a valid page.
  useEffect(() => {
    setPage(1)
  }, [containsFilters, dateFrom, dateTo, pageSize, rows])

  // Page slice — only rows that are visible in the current table view.
  // Sums and breakdowns still use the full filteredRows.
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, safePage, pageSize])

  // Visible columns based on view toggles
  const visibleCols = useMemo(() => {
    const cols = [...ALWAYS_VISIBLE_COLS]
    if (showGeneral) cols.push(...GENERAL_COLS)
    if (showDay1) cols.push(...DAY1_COLS)
    if (showLate) cols.push(...LATE_COLS)
    return cols
  }, [showGeneral, showDay1, showLate])

  // Sums of numeric columns currently visible
  const sums = useMemo(() => {
    const result = {}
    for (const col of visibleCols) {
      if (!NUMERIC_COLS.has(col)) continue
      let s = 0
      for (const r of filteredRows) {
        const n = parseNumber(r[col])
        if (Number.isFinite(n)) s += n
      }
      result[col] = s
    }
    return result
  }, [filteredRows, visibleCols])

  // Breakdowns
  const byCountry = useMemo(() => groupCount(filteredRows, COL.COUNTRY), [filteredRows])
  const byFlowCountry = useMemo(
    () => groupCount(filteredRows, [COL.FLOW, COL.COUNTRY]),
    [filteredRows],
  )
  const byFlowType = useMemo(
    () => groupCount(filteredRows, [COL.FLOW, COL.TYPE]),
    [filteredRows],
  )
  const byWho = useMemo(() => groupCount(filteredRows, COL.WHO), [filteredRows])
  const byType = useMemo(() => groupCount(filteredRows, COL.TYPE), [filteredRows])

  // Unique values per filterable column — used to populate datalist suggestions
  // for the contains-filter inputs. Computed from ALL rows (not filtered)
  // so the user can always see every available option.
  const uniqueValuesByCol = useMemo(() => {
    const map = {}
    for (const idx of CONTAINS_FILTER_COLS) {
      const seen = new Set()
      for (const r of rows) {
        const v = (r[idx] || '').toString().trim()
        if (v) seen.add(v)
      }
      // Sort alphabetically; cap to 500 to avoid massive datalists
      map[idx] = Array.from(seen).sort((a, b) => a.localeCompare(b)).slice(0, 500)
    }
    return map
  }, [rows])

  function clearAllFilters() {
    setContainsFilters({})
    setDateFrom('')
    setDateTo('')
  }

  const hasFilters =
    Object.values(containsFilters).some((v) => v && v.trim()) ||
    dateFrom ||
    dateTo

  return (
    <main className="flex-1 bg-paper min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="px-10 py-8 max-w-7xl">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">
                Activity Tracker
              </div>
              <h1 className="font-display text-4xl text-ink-900">Campaign performance</h1>
              <p className="text-ink-500 text-sm mt-1">
                Live view of the campaign tracking sheet. Click Refresh to pull the latest data.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {lastFetchedAt && (
                <span className="text-xs text-ink-500">
                  Last refreshed: <span className="font-mono">{formatTime(lastFetchedAt)}</span>
                </span>
              )}
              <button
                onClick={loadSheet}
                disabled={loading}
                className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm rounded transition disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-10 py-6 max-w-7xl">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* View mode toggles */}
        <div className="bg-white border border-ink-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
              Show columns:
            </span>
            <ToggleChip
              checked={showGeneral}
              onChange={setShowGeneral}
              label="General (totals)"
              hint="I–N"
            />
            <ToggleChip
              checked={showDay1}
              onChange={setShowDay1}
              label="Day 1"
              hint="O–U"
            />
            <ToggleChip
              checked={showLate}
              onChange={setShowLate}
              label="7 & 14 day"
              hint="V–W"
            />
            <span className="text-xs text-ink-400 ml-auto">
              A–H (campaign info) is always shown
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-ink-200 rounded-lg p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
              Filter "contains":
            </span>
            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="ml-auto text-xs text-ink-500 hover:text-ink-900 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {CONTAINS_FILTER_COLS.map((idx) => {
              const listId = `filter-options-${idx}`
              const options = uniqueValuesByCol[idx] || []
              return (
                <div key={idx}>
                  <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">
                    {headers[idx] || `Col ${String.fromCharCode(65 + idx)}`}
                    {options.length > 0 && (
                      <span className="ml-1 text-ink-300 normal-case tracking-normal">
                        ({options.length})
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    list={listId}
                    value={containsFilters[idx] || ''}
                    onChange={(e) =>
                      setContainsFilters((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    placeholder="contains… or pick from list"
                    className="w-full px-2 py-1 text-sm bg-paper border border-ink-200 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {options.length > 0 && (
                    <datalist id={listId}>
                      {options.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-ink-100">
            <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
              Creation date:
            </span>
            <span className="text-xs text-ink-500">from</span>
            <input
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="DD/MM"
              maxLength={5}
              className="w-20 px-2 py-1 text-sm bg-paper border border-ink-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-xs text-ink-500">to</span>
            <input
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="DD/MM"
              maxLength={5}
              className="w-20 px-2 py-1 text-sm bg-paper border border-ink-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex gap-1 ml-2">
              <DatePill onClick={() => setRangeLastDays(7, setDateFrom, setDateTo)}>Last 7d</DatePill>
              <DatePill onClick={() => setRangeLastDays(14, setDateFrom, setDateTo)}>Last 14d</DatePill>
              <DatePill onClick={() => setRangeLastDays(30, setDateFrom, setDateTo)}>Last 30d</DatePill>
              <DatePill onClick={() => setRangeThisMonth(setDateFrom, setDateTo)}>This month</DatePill>
              <DatePill onClick={() => { setDateFrom(''); setDateTo('') }}>All</DatePill>
            </div>
            <span className="text-[10px] text-ink-400 ml-auto">
              Year is assumed to be the current year
            </span>
          </div>
        </div>

        {/* Sums row */}
        {filteredRows.length > 0 && Object.keys(sums).length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-medium">
                Sums for {filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'} shown
              </span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {visibleCols
                .filter((col) => NUMERIC_COLS.has(col))
                .map((col) => (
                  <div key={col} className="bg-white rounded p-2 border border-emerald-100">
                    <div className="text-[9px] uppercase tracking-wider text-ink-500 font-medium truncate">
                      {headers[col] || colLetter(col)}
                    </div>
                    <div className="text-base font-display text-ink-900 tabular">
                      {formatNumber(sums[col])}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Breakdowns */}
        {filteredRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <BreakdownPanel title="By Country" entries={byCountry} />
            <BreakdownPanel title="By Who" entries={byWho} />
            <BreakdownPanel title="By Type" entries={byType} />
            <BreakdownPanel title="By Flow + Country" entries={byFlowCountry} />
            <BreakdownPanel title="By Flow + Type" entries={byFlowType} />
          </div>
        )}

        {/* Result count + pagination controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="text-sm text-ink-500 tabular">
            {filteredRows.length === 0 ? (
              <>0 rows</>
            ) : (
              <>
                Showing <span className="font-medium text-ink-700">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)}
                </span> of {filteredRows.length}
                {filteredRows.length !== rows.length && (
                  <span className="text-ink-400"> · filtered from {rows.length}</span>
                )}
              </>
            )}
          </div>

          {filteredRows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
                Per page:
              </span>
              {[10, 50, 100, 200, 500, 1000].map((n) => (
                <button
                  key={n}
                  onClick={() => setPageSize(n)}
                  className={`px-2 py-0.5 text-xs rounded border transition ${
                    pageSize === n
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="text-ink-300 mx-1">|</span>
              <PaginationControls
                page={safePage}
                totalPages={totalPages}
                onChange={setPage}
              />
            </div>
          )}
        </div>

        {/* Sums-vs-page reminder when paged */}
        {filteredRows.length > pageSize && (
          <p className="text-[11px] text-ink-400 mb-2 italic">
            Sums and breakdowns above include all {filteredRows.length} filtered rows, not just this page.
          </p>
        )}

        {/* Table */}
        {!loading && rows.length === 0 && !error && (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No data loaded yet. Click Refresh to fetch.</p>
          </div>
        )}

        {!loading && rows.length > 0 && filteredRows.length === 0 && (
          <div className="bg-white border border-dashed border-ink-200 rounded-lg p-12 text-center">
            <p className="text-ink-400">No rows match the current filters.</p>
            <button
              onClick={clearAllFilters}
              className="mt-3 text-sm text-accent hover:text-accent-dark font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && filteredRows.length > 0 && (
          <div className="bg-white border border-ink-200 rounded-lg overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 bg-ink-50 z-10">
                <tr>
                  {visibleCols.map((col) => (
                    <th
                      key={col}
                      className="border-b border-r border-ink-200 px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider text-ink-700 whitespace-nowrap"
                    >
                      {headers[col] || colLetter(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-ink-50/40">
                    {visibleCols.map((col) => {
                      const value = row[col] || ''
                      const isNumeric = NUMERIC_COLS.has(col)
                      const isUrl = col === COL.WEBSITE_URL && value.startsWith('http')
                      return (
                        <td
                          key={col}
                          className={`border-b border-r border-ink-100 px-2 py-1 align-top ${
                            isNumeric ? 'tabular text-right' : ''
                          }`}
                        >
                          {isUrl ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline"
                              title={value}
                            >
                              link
                            </a>
                          ) : isNumeric && parseNumber(value) !== null ? (
                            formatNumber(parseNumber(value))
                          ) : col === COL.CAMPAIGN_NAME ? (
                            <span className="block whitespace-nowrap font-mono text-[11px]" title={value}>
                              {value}
                            </span>
                          ) : (
                            <span className="block max-w-[180px] truncate" title={value}>
                              {value}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom pagination — only shown when more than one page */}
        {!loading && filteredRows.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
            <div className="text-xs text-ink-500 tabular">
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)} of {filteredRows.length}
            </div>
            <PaginationControls
              page={safePage}
              totalPages={totalPages}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </main>
  )
}

// ============================================================
// HELPERS
// ============================================================
function PaginationControls({ page, totalPages, onChange }) {
  const canPrev = page > 1
  const canNext = page < totalPages
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(1)}
        disabled={!canPrev}
        className="px-2 py-0.5 text-xs bg-white border border-ink-200 rounded hover:border-ink-400 disabled:opacity-30 disabled:cursor-not-allowed"
        title="First page"
      >
        ‹‹
      </button>
      <button
        onClick={() => onChange(page - 1)}
        disabled={!canPrev}
        className="px-2 py-0.5 text-xs bg-white border border-ink-200 rounded hover:border-ink-400 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Previous page"
      >
        ‹
      </button>
      <span className="px-2 text-xs text-ink-700 tabular">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={!canNext}
        className="px-2 py-0.5 text-xs bg-white border border-ink-200 rounded hover:border-ink-400 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Next page"
      >
        ›
      </button>
      <button
        onClick={() => onChange(totalPages)}
        disabled={!canNext}
        className="px-2 py-0.5 text-xs bg-white border border-ink-200 rounded hover:border-ink-400 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Last page"
      >
        ››
      </button>
    </div>
  )
}

function ToggleChip({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span className={`text-sm ${checked ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>
        {label}
      </span>
      {hint && <span className="text-[10px] text-ink-400 font-mono">{hint}</span>}
    </label>
  )
}

function DatePill({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-[10px] bg-white border border-ink-200 rounded hover:border-ink-400"
    >
      {children}
    </button>
  )
}

function BreakdownPanel({ title, entries }) {
  const items = Array.from(entries.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  if (items.length === 0) return null
  return (
    <div className="bg-white border border-ink-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-500 font-medium mb-2">
        {title}
      </div>
      <ul className="space-y-0.5 max-h-48 overflow-y-auto">
        {items.map(([key, count]) => (
          <li key={key} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-ink-700 truncate">{key || '—'}</span>
            <span className="font-mono tabular text-ink-900 font-medium flex-shrink-0">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function setRangeLastDays(days, setFrom, setTo) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  setFrom(formatDDMM(start))
  setTo(formatDDMM(end))
}

function setRangeThisMonth(setFrom, setTo) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  setFrom(formatDDMM(start))
  setTo(formatDDMM(end))
}

function formatDDMM(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Parse "DD/MM" assuming current year. Returns Date or null.
function parseDDMM(str) {
  if (!str) return null
  const cleaned = String(str).trim()
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  let yr = m[3] ? parseInt(m[3], 10) : new Date().getFullYear()
  if (yr < 100) yr += 2000
  if (day < 1 || day > 31 || mo < 1 || mo > 12) return null
  return new Date(yr, mo - 1, day)
}

// Parse a numeric cell. Strips $, %, commas, whitespace. Returns null if NaN.
function parseNumber(str) {
  if (str === null || str === undefined || str === '') return null
  const cleaned = String(str).replace(/[$,%\s]/g, '').replace(/[^\d.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function formatNumber(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (Math.abs(n) < 0.01 && n !== 0) return n.toFixed(4)
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function colLetter(idx) {
  return String.fromCharCode(65 + idx)
}

// Group rows by a column or combination of columns. Returns Map<key, count>.
function groupCount(rows, colOrCols) {
  const cols = Array.isArray(colOrCols) ? colOrCols : [colOrCols]
  const m = new Map()
  for (const r of rows) {
    const key = cols.map((c) => (r[c] || '').toString().trim() || '—').join(' · ')
    m.set(key, (m.get(key) || 0) + 1)
  }
  return m
}

// ============================================================
// CSV PARSER
// ============================================================
// gviz/tq returns standard CSV with quoted fields and embedded quotes escaped
// as "". This handles those edge cases.
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      // newline (handle \r\n)
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
      continue
    }
    cell += ch
    i++
  }
  // Final cell/row
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
