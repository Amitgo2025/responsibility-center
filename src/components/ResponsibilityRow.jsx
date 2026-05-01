import TagChip from './TagChip'

const STATUS_LABELS = {
  active: { label: 'Active', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  review: { label: 'Under Review', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  transitioning: { label: 'Transitioning', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
}

export default function ResponsibilityRow({
  responsibility,
  allTags,
  allCategories,
  isAdmin,
  noteCount,
  openNoteCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onOpenNote,
  onViewNotes,
  index,
}) {
  const r = responsibility
  const tags = (r.tags || [])
    .map((id) => allTags.find((t) => t.id === id))
    .filter(Boolean)

  return (
    <li
      className="bg-white border border-ink-200 rounded-lg p-5 hover:shadow-sm transition slide-right"
      style={{ animationDelay: `${(index || 0) * 0.03}s` }}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-medium text-ink-900 text-lg leading-tight">
          {r.title || <span className="italic text-ink-400">Untitled</span>}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r.status && STATUS_LABELS[r.status] && (
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${STATUS_LABELS[r.status].tone}`}
            >
              {STATUS_LABELS[r.status].label}
            </span>
          )}
        </div>
      </div>

      {r.description && (
        <p className="text-ink-600 text-sm leading-relaxed whitespace-pre-wrap mb-3">
          {r.description}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              category={allCategories.find((c) => c.id === tag.categoryId)}
              size="xs"
            />
          ))}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-ink-100">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNote}
            className="px-2.5 py-1 text-xs bg-accent/10 text-accent hover:bg-accent hover:text-white rounded transition flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Open note
          </button>
          {noteCount > 0 && (
            <button
              onClick={onViewNotes}
              className="px-2.5 py-1 text-xs text-ink-500 hover:text-ink-900 rounded transition flex items-center gap-1.5"
            >
              {noteCount} note{noteCount === 1 ? '' : 's'}
              {openNoteCount > 0 && (
                <span className="px-1.5 py-0.5 bg-accent text-white text-[9px] rounded-full font-bold tabular">
                  {openNoteCount} open
                </span>
              )}
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              className="px-2 py-1 text-ink-300 hover:text-ink-700 text-xs"
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              className="px-2 py-1 text-ink-300 hover:text-ink-700 text-xs"
              title="Move down"
            >
              ▼
            </button>
            <button
              onClick={onEdit}
              className="px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-100 rounded transition"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
