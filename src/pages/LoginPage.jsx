import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tryLogin, getAuthConfig } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const config = await getAuthConfig()
        if (!active) return
        if (!config) {
          navigate('/setup', { replace: true })
          return
        }
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
    setSubmitting(true)
    setError('')
    try {
      const role = await tryLogin(password)
      if (!role) {
        setError('That password did not match. Try again.')
        setSubmitting(false)
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-ink-400 text-sm tracking-widest uppercase">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12 fade-up">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-ink-900 mb-6">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M9 8h14M9 16h10M9 24h14" stroke="#c46a3a" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-display text-5xl text-ink-900 leading-none mb-3">
            Responsibility
            <br />
            <span className="italic font-light">Center</span>
          </h1>
          <p className="text-ink-500 text-sm tracking-wide">
            Who owns what. Who to ask. What is in motion.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="fade-up" style={{ animationDelay: '0.1s' }}>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-ink-400 mb-2">
              Access password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-md text-ink-900 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              placeholder="Enter password"
            />
          </label>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-6 w-full px-6 py-3 bg-ink-900 text-ink-50 rounded-md font-medium tracking-wide hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Checking…' : 'Enter'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-ink-400">
          One password to view. Admin password unlocks editing.
        </p>
      </div>
    </div>
  )
}
