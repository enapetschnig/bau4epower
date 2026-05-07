import { Link } from 'react-router-dom'
import { Briefcase, Clock, FileText, UsersThree, ChartLine, Wrench, Notepad, FolderOpen, GearSix } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Home() {
  const { profile, fullName, isAdmin } = useAuth()
  const firstName = (fullName || profile?.email || '').split(' ')[0] || ''

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 11) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  const userTiles = [
    { to: '/zeiterfassung', label: 'Zeiterfassung', desc: 'Arbeitsstunden eintragen', Icon: Clock, color: 'from-blue-500 to-blue-600' },
    { to: '/projekte', label: 'Projekte', desc: 'Baustellen & Dokumente', Icon: Briefcase, color: 'from-primary to-primary-dark' },
    { to: '/regiearbeiten', label: 'Regiearbeiten', desc: 'Service-Einsätze erfassen', Icon: Wrench, color: 'from-purple-500 to-purple-600' },
    { to: '/angebote', label: 'PV-Angebote', desc: 'Photovoltaik kalkulieren', Icon: FileText, color: 'from-emerald-500 to-emerald-600' },
    { to: '/meine-stunden', label: 'Meine Stunden', desc: 'Übersicht & Bilanz', Icon: ChartLine, color: 'from-amber-500 to-amber-600' },
    { to: '/meine-dokumente', label: 'Meine Dokumente', desc: 'Lohnzettel & Krankmeldungen', Icon: FolderOpen, color: 'from-indigo-500 to-indigo-600' },
  ]

  const adminTiles = [
    { to: '/auswertung', label: 'Stundenauswertung', desc: 'Mitarbeiter & Projekte analysieren', Icon: ChartLine, color: 'from-rose-500 to-rose-600' },
    { to: '/mitarbeiter', label: 'Mitarbeiter', desc: 'Team verwalten', Icon: UsersThree, color: 'from-teal-500 to-teal-600' },
    { to: '/einstellungen', label: 'Einstellungen', desc: 'App & Profil', Icon: GearSix, color: 'from-gray-500 to-gray-600' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 pb-10">
      {/* Greeting Block */}
      <div className="mb-5">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider">{greeting}</p>
        <h1 className="text-2xl font-bold text-secondary mt-0.5">
          {firstName ? `Hallo, ${firstName}!` : 'Willkommen!'}
        </h1>
        <p className="text-[12px] text-gray-400 mt-1">Was möchtest du heute machen?</p>
      </div>

      {/* User Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {userTiles.map(t => <Tile key={t.to} {...t} />)}
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <>
          <div className="mt-8 mb-3">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Administration</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {adminTiles.map(t => <Tile key={t.to} {...t} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ to, label, desc, Icon, color }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl border border-gray-100 p-4 active:scale-[0.97] transition-transform block"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br ${color}`}>
        <Icon size={20} weight="fill" className="text-white" />
      </div>
      <p className="text-[14px] font-semibold text-secondary leading-tight">{label}</p>
      <p className="text-[11px] text-gray-400 mt-1 leading-snug">{desc}</p>
    </Link>
  )
}
