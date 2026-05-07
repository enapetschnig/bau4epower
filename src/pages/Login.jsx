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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size="xl" />
          <p className="text-[10px] text-gray-300 tracking-[0.2em] uppercase">Mitarbeiter-App</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full border-b border-gray-200 px-0 py-2.5 text-[13px] focus:outline-none focus:border-primary bg-transparent placeholder:text-gray-300 transition-colors"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-Mail"
            required
            autoComplete="email"
          />
          <input
            type="password"
            className="w-full border-b border-gray-200 px-0 py-2.5 text-[13px] focus:outline-none focus:border-primary bg-transparent placeholder:text-gray-300 transition-colors"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Passwort"
            required
            autoComplete="current-password"
          />

          {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-md text-[13px] disabled:opacity-40 transition-colors mt-4"
          >
            {loading ? (
              <SpinnerGap size={16} weight="bold" className="animate-spin mx-auto" />
            ) : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-300 tracking-wide">
          ET KÖNIG GmbH · Frojach
        </p>
      </div>
    </div>
  )
}
