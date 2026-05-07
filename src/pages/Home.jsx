import { useNavigate } from 'react-router-dom'
import { Briefcase, Clock, FileText, UsersThree, ChartLine, Wrench, ArrowsLeftRight, BookmarkSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { profile, fullName, isAdmin } = useAuth()

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 11) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  const firstName = (fullName || profile?.email || '').split(' ')[0] || ''

  const tiles = [
    { to: '/projekte', label: 'Projekte', desc: 'Baustellen verwalten', Icon: Briefcase, color: 'bg-primary' },
    { to: '/zeiterfassung', label: 'Zeiterfassung', desc: 'Stunden eintragen', Icon: Clock, color: 'bg-blue-500' },
    { to: '/angebote', label: 'Angebote', desc: 'Kalkulation & Erstellung', Icon: FileText, color: 'bg-emerald-500' },
    { to: '/regiearbeiten', label: 'Regiearbeiten', desc: 'Service-Einsätze', Icon: Wrench, color: 'bg-purple-500' },
    { to: '/meine-stunden', label: 'Meine Stunden', desc: 'Übersicht & Bilanz', Icon: ChartLine, color: 'bg-amber-500' },
  ]

  if (isAdmin) {
    tiles.push(
      { to: '/mitarbeiter', label: 'Mitarbeiter', desc: 'Team verwalten', Icon: UsersThree, color: 'bg-rose-500' },
      { to: '/auswertung', label: 'Auswertung', desc: 'Stundenanalyse', Icon: ChartLine, color: 'bg-indigo-500' },
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-5 pb-6">
      <div className="mb-5">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider">{greeting}</p>
        <h1 className="text-xl font-bold text-secondary mt-0.5">
          {firstName ? `Hallo, ${firstName}.` : 'Willkommen.'}
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Was möchtest du heute machen?</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {tiles.map(t => (
          <button
            key={t.to}
            onClick={() => navigate(t.to)}
            className="bg-white rounded-xl border border-gray-100 p-3.5 text-left active:scale-[0.97] transition-transform"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className={`w-9 h-9 ${t.color} rounded-lg flex items-center justify-center mb-2`}>
              <t.Icon size={18} weight="fill" className="text-white" />
            </div>
            <p className="text-[13px] font-semibold text-secondary leading-tight">{t.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
