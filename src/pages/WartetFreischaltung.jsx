import { useState } from 'react'
import { Hourglass, ArrowsClockwise, SignOut, EnvelopeSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import Logo from '../components/Logo.jsx'

export default function WartetFreischaltung() {
  const { profile, signOut, refreshRole, fullName } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  async function handleCheck() {
    setRefreshing(true)
    try {
      await refreshRole()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <Logo size="xl" />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4">
            <Hourglass size={32} weight="fill" className="text-amber-500 animate-pulse" />
          </div>

          <h1 className="text-2xl font-bold text-secondary mb-2">Account wartet auf Freischaltung</h1>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
            {fullName ? `Hallo ${fullName.split(' ')[0]}!` : 'Hallo!'}<br/>
            Dein Account wurde erstellt, muss aber noch von einem Administrator
            freigeschaltet werden, bevor du die App nutzen kannst.
          </p>

          {profile?.deactivated_at && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
              <p className="text-[11px] font-bold text-rose-700">Account deaktiviert</p>
              {profile.deactivation_reason && (
                <p className="text-[11px] text-rose-600 mt-1">{profile.deactivation_reason}</p>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-left">
            <p className="text-[11px] font-semibold text-blue-900 mb-1">Was passiert jetzt?</p>
            <ol className="text-[11px] text-blue-800 space-y-1 list-decimal list-inside">
              <li>Der Admin sieht deine Registrierung</li>
              <li>Er weist dir ein Gewerk + Rolle zu</li>
              <li>Sobald freigeschaltet: Du kannst loslegen</li>
            </ol>
          </div>

          <button
            onClick={handleCheck}
            disabled={refreshing}
            className="btn-primary w-full mb-2"
          >
            <ArrowsClockwise size={14} weight="bold" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Prüfe Status...' : 'Erneut prüfen'}
          </button>

          <button
            onClick={signOut}
            className="btn-secondary w-full"
          >
            <SignOut size={14} weight="bold" />
            Abmelden
          </button>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <EnvelopeSimple size={18} weight="fill" className="text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[12px] font-semibold text-secondary">Frage an den Administrator?</p>
            <a href="mailto:office@etkoenig.at" className="text-[11px] text-primary hover:underline">
              office@etkoenig.at
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-6 tracking-wide">
          ET KÖNIG GmbH · Frojach
        </p>
      </div>
    </div>
  )
}
