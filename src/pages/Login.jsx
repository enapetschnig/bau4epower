import { useState } from 'react'
import { SpinnerGap, EnvelopeSimple, Lock } from '@phosphor-icons/react'
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)' }}>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Logo size="xl" />
          <p className="text-[11px] text-gray-400 tracking-[0.25em] uppercase mt-2">Mitarbeiter-Portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 4px 16px rgba(246,135,20,0.08)' }}>

          <h1 className="text-base font-bold text-secondary mb-1">Willkommen zurück</h1>
          <p className="text-[12px] text-gray-400 mb-5">Melde dich mit deinen Zugangsdaten an</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label block mb-1">E-Mail</label>
              <div className="relative">
                <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="email"
                  className="input-field pl-9"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@et-koenig.at"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="label block mb-1">Passwort</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="password"
                  className="input-field pl-9"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="text-[11px] text-red-500 bg-red-50 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {loading ? (
                <SpinnerGap size={16} weight="bold" className="animate-spin" />
              ) : 'Anmelden'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-300 tracking-wide mt-6">
          ET KÖNIG GmbH · Frojach
        </p>
        <p className="text-center text-[10px] text-gray-300 mt-1">
          Einen Herzschlag voraus
        </p>
      </div>
    </div>
  )
}
