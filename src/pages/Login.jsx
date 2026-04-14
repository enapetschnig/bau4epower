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
    <div className="min-h-screen bg-gray-light flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Logo size="lg" />
          <p className="text-gray-500 text-sm text-center">
            KI-gestützte Angebotserstellung
          </p>
        </div>

        {/* Form */}
        <div className="card space-y-4">
          <h1 className="text-xl font-bold text-secondary text-center">Anmelden</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label mb-2 block">E-Mail</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@napetschnig.at"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label mb-2 block">Passwort</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <SpinnerGap size={20} weight="bold" className="animate-spin" />
              ) : 'Anmelden'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          NAPETSCHNIG. · Wien
        </p>
      </div>
    </div>
  )
}
