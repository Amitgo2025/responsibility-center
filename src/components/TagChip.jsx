// Renders a tag chip. Auto-computes a readable text color from the bg color.

function getReadableTextColor(hex) {
  if (!hex || !hex.startsWith('#')) return '#ffffff'
  const h = hex.length === 4
    ? '#' + hex.slice(1).split('').map((c) => c + c).join('')
    : hex
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1c1815' : '#ffffff'
}

export default function TagChip({ tag, category, onRemove, size = 'sm' }) {
  if (!tag) return null
  const bg = tag.color || '#c46a3a'
  const text = getReadableTextColor(bg)
  const sizeClass = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-[11px] px-2 py-0.5'

  return (
    <span
      className={`chip ${sizeClass}`}
      style={{
        background: bg,
        color: text,
        borderColor: bg,
      }}
      title={category ? `${category.name}: ${tag.name}` : tag.name}
    >
      {category && size !== 'xs' && (
        <span className="opacity-70 font-normal">{category.name}:</span>
      )}
      <span className="font-medium">{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 opacity-70 hover:opacity-100"
          aria-label="Remove tag"
        >
          ×
        </button>
      )}
    </span>
  )
}
