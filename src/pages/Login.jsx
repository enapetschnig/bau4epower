import { useState } from 'react'
import { SpinnerGap } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import Logo from '../components/Logo.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <Logo size="lg" />
          <p className="text-gray-400 text-[11px] tracking-widest uppercase">Angebots-App</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              className="w-full border-b border-gray-200 px-1 py-3 text-sm focus:outline-none focus:border-secondary bg-transparent placeholder:text-gray-300 transition-colors"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-Mail"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <input
              type="password"
              className="w-full border-b border-gray-200 px-1 py-3 text-sm focus:outline-none focus:border-secondary bg-transparent placeholder:text-gray-300 transition-colors"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 text-center py-1">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6"
          >
            {loading ? (
              <SpinnerGap size={18} weight="bold" className="animate-spin" />
            ) : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-300 tracking-wide">
          NAPETSCHNIG. · Wien
        </p>
      </div>
    </div>
  )
}
