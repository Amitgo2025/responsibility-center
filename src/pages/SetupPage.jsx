import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthConfig, initializeAuth } from '../lib/auth'
import { seedDefaultData } from '../lib/db'

export default function SetupPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [viewer, setViewer] = useState('')
  const [admin, setAdmin] = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')
  const [seedToggle, setSeedToggle] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const config = await getAuthConfig()
        if (!active) return
        if (config) {
          // Already initialized — kick to login
          navigate('/login', { replace: true })
          return
        }
        setAllowed(true)
        setChecking(false)
      } catch (err) {
        if (!active) return
        setError(`Could not reach the server: ${err.message}`)
        setChecking(false)
      }
    })()
    return () => {
      active = false
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (admin !== adminConfirm) {
      setError('Admin passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await initializeAuth(viewer, admin)
      if (seedToggle) {
        await seedDefaultData()
      }
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Checking…</div>
      </div>
    )
  }

  if (!allowed) return null

  return (
    <div className="min-h-screen bg-paper py-16 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-10 fade-up">
          <span className="inline-block px-2 py-1 bg-accent/10 text-accent text-xs uppercase tracking-widest rounded mb-4">
            First-time setup
          </span>
          <h1 className="font-display text-4xl text-ink-900 mb-3">Set up your access</h1>
          <p className="text-ink-500 leading-relaxed">
            Two passwords run the system. The viewer password lets the team open the site read-only.
            The admin password lets you edit responsibilities and manage settings. Pick something you
            can remember — there is no recovery.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-white border border-ink-200 rounded-lg p-6">
            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-widest text-ink-400 mb-2">
                Viewer password — for everyone on the team
              </span>
              <input
                type="text"
                value={viewer}
                onChange={(e) => setViewer(e.target.value)}
                className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-md text-ink-900 font-mono focus:outline-none focus:ring-2 focus:ring-accent transition"
                placeholder="At least 4 characters"
              />
              <span className="block mt-2 text-xs text-ink-400">
                Anyone with this can see the site, but cannot edit.
              </span>
            </label>

            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-widest text-ink-400 mb-2">
                Admin password — for you only
              </span>
              <input
                type="text"
                value={admin}
                onChange={(e) => setAdmin(e.target.value)}
                className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-md text-ink-900 font-mono focus:outline-none focus:ring-2 focus:ring-accent transition"
                placeholder="At least 6 characters"
              />
              <span className="block mt-2 text-xs text-ink-400">
                Edits, manages users, changes passwords. Don't share this one.
              </span>
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-ink-400 mb-2">
                Confirm admin password
              </span>
              <input
                type="text"
                value={adminConfirm}
                onChange={(e) => setAdminConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-md text-ink-900 font-mono focus:outline-none focus:ring-2 focus:ring-accent transition"
                placeholder="Type it again"
              />
            </label>
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-4 bg-white border border-ink-200 rounded-lg">
            <input
              type="checkbox"
              checked={seedToggle}
              onChange={(e) => setSeedToggle(e.target.checked)}
              className="mt-1 accent-accent"
            />
            <div>
              <div className="font-medium text-ink-900">Load the team data</div>
              <div className="text-sm text-ink-500 mt-1">
                Imports all 7 tabs (Amit, Dina, Elran, Or, Elad, Yoav, Cross-Cutting) with the
                responsibilities from your team restructure docs and your operations list.
              </div>
            </div>
          </label>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !viewer || !admin || !adminConfirm}
            className="w-full px-6 py-3 bg-ink-900 text-ink-50 rounded-md font-medium tracking-wide hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Setting up…' : 'Initialize'}
          </button>
        </form>
      </div>
    </div>
  )
}
