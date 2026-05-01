import { useState } from 'react'
import TagChip from './TagChip'

export default function TagPicker({ allTags, allCategories, selectedIds, onChange, compact }) {
  const [open, setOpen] = useState(false)

  const tagsByCategory = allCategories.map((cat) => ({
    category: cat,
    tags: allTags.filter((t) => t.categoryId === cat.id),
  }))

  // Tags whose category was removed
  const orphans = allTags.filter((t) => !allCategories.find((c) => c.id === t.categoryId))

  function toggle(tagId) {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedIds, tagId])
    }
  }

  const selectedTags = selectedIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter(Boolean)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 items-center min-h-[28px]">
        {selectedTags.length === 0 && !compact && (
          <span className="text-xs text-ink-400 italic">No tags</span>
        )}
        {selectedTags.map((tag) => {
          const cat = allCategories.find((c) => c.id === tag.categoryId)
          return (
            <TagChip
              key={tag.id}
              tag={tag}
              category={cat}
              onRemove={() => toggle(tag.id)}
            />
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-accent hover:text-accent-dark px-2 py-0.5 border border-dashed border-accent/40 rounded-full"
        >
          {open ? '× Done' : '+ Add tag'}
        </button>
      </div>

      {open && (
        <div className="border border-ink-200 rounded-md bg-white p-3 space-y-3 max-h-72 overflow-y-auto">
          {tagsByCategory.length === 0 && (
            <p className="text-xs text-ink-400">
              No tag categories yet. Create some in admin settings.
            </p>
          )}
          {tagsByCategory.map(({ category, tags }) => (
            <div key={category.id}>
              <div className="text-[10px] uppercase tracking-widest text-ink-400 mb-1.5 font-medium">
                {category.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 && (
                  <span className="text-xs text-ink-400 italic">
                    No tags in this category yet
                  </span>
                )}
                {tags.map((tag) => {
                  const sel = selectedIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggle(tag.id)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${
                        sel
                          ? 'border-transparent'
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
          {orphans.length > 0 && (
            <div className="text-[10px] text-amber-700 italic pt-2 border-t border-ink-100">
              {orphans.length} tag(s) belong to a deleted category.
            </div>
          )}
        </div>
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
