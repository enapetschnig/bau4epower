import { Link } from 'react-router-dom'
import { Briefcase, Clock, FileText, UsersThree, ChartLine, Wrench, FolderOpen, GearSix, CaretRight, Coin } from '@phosphor-icons/react'
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
    {
      to: '/zeiterfassung',
      label: 'Zeiterfassung',
      desc: 'Arbeitsstunden eintragen',
      Icon: Clock,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      to: '/projekte',
      label: 'Projekte',
      desc: 'Baustellen & Dokumente',
      Icon: Briefcase,
      iconBg: 'bg-orange-100',
      iconColor: 'text-primary',
    },
    {
      to: '/regiearbeiten',
      label: 'Regiearbeiten',
      desc: 'Service-Einsätze erfassen',
      Icon: Wrench,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      to: '/angebote',
      label: 'PV-Angebote',
      desc: 'Photovoltaik kalkulieren',
      Icon: FileText,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      to: '/meine-stunden',
      label: 'Meine Stunden',
      desc: 'Übersicht & Bilanz',
      Icon: ChartLine,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      to: '/meine-dokumente',
      label: 'Meine Dokumente',
      desc: 'Lohnzettel & Krankmeldungen',
      Icon: FolderOpen,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
  ]

  const adminTiles = [
    {
      to: '/auswertung',
      label: 'Stundenauswertung',
      desc: 'Mitarbeiter & Projekte analysieren',
      Icon: ChartLine,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
    },
    {
      to: '/mitarbeiter',
      label: 'Mitarbeiter',
      desc: 'Team verwalten',
      Icon: UsersThree,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      to: '/zulagen',
      label: 'Zulagen',
      desc: 'Taggeld, Schmutzzulage uvm.',
      Icon: Coin,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      to: '/angebote/material',
      label: 'PV-Material',
      desc: 'Produkt-Katalog verwalten',
      Icon: Wrench,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      to: '/einstellungen',
      label: 'Einstellungen',
      desc: 'App & Profil konfigurieren',
      Icon: GearSix,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-12">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{greeting}</p>
        <h1 className="text-2xl font-bold text-secondary mt-1">
          {firstName ? `Hallo, ${firstName}` : 'Willkommen'}
          <span className="text-primary">!</span>
        </h1>
        <p className="text-[13px] text-gray-500 mt-1">Was möchtest du heute machen?</p>
      </div>

      {/* User Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {userTiles.map(t => <Tile key={t.to} {...t} />)}
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <>
          <div className="mt-10 mb-4 flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-semibold">Administration</p>
            <div className="h-px bg-gray-200 flex-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adminTiles.map(t => <Tile key={t.to} {...t} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ to, label, desc, Icon, iconBg, iconColor }) {
  return (
    <Link to={to} className="tile-card group">
      <div className="flex items-center gap-3.5">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}>
          <Icon size={22} weight="fill" className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-secondary leading-tight">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
        </div>
        <CaretRight size={16} weight="bold" className="text-gray-300 flex-shrink-0 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  )
}
