import { useEffect, useState } from 'react'

// Renders a modal with a large preview of an attachment.
// If `gallery` is provided (array of attachments), supports prev/next navigation.
export default function Lightbox({ attachment, gallery, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex || 0)
  const items = gallery && gallery.length ? gallery : (attachment ? [attachment] : [])
  const current = items[index]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && items.length > 1) {
        setIndex((i) => (i + 1) % items.length)
      }
      if (e.key === 'ArrowLeft' && items.length > 1) {
        setIndex((i) => (i - 1 + items.length) % items.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  if (!current) return null

  const isImage = (current.type || '').startsWith('image/')

  return (
    <div
      className="fixed inset-0 bg-ink-900/90 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-ink-800 hover:bg-ink-700 text-white rounded-full flex items-center justify-center z-10"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Prev/Next */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => (i - 1 + items.length) % items.length)
            }}
            className="absolute left-4 w-10 h-10 bg-ink-800 hover:bg-ink-700 text-white rounded-full flex items-center justify-center z-10"
            aria-label="Previous"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => (i + 1) % items.length)
            }}
            className="absolute right-4 w-10 h-10 bg-ink-800 hover:bg-ink-700 text-white rounded-full flex items-center justify-center z-10"
            aria-label="Next"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Content */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage ? (
          <img
            src={current.dataUrl}
            alt={current.name}
            className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl"
          />
        ) : (
          <div className="bg-white rounded p-12 max-w-md text-center">
            <p className="text-ink-600 mb-3">Cannot preview this file type</p>
            <a
              href={current.dataUrl}
              download={current.name}
              className="inline-block px-4 py-2 bg-ink-900 text-white text-sm rounded hover:bg-ink-800"
            >
              Download {current.name}
            </a>
          </div>
        )}

        <div className="mt-3 px-4 py-2 bg-ink-800/80 backdrop-blur text-ink-100 text-sm rounded flex items-center gap-3">
          <span className="truncate max-w-md">{current.name}</span>
          {current.size && <span className="text-ink-300 text-xs">{Math.round(current.size / 1024)} KB</span>}
          {items.length > 1 && (
            <span className="text-ink-300 text-xs tabular">
              {index + 1} / {items.length}
            </span>
          )}
          {isImage && (
            <a
              href={current.dataUrl}
              download={current.name}
              className="text-xs text-accent-light hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
