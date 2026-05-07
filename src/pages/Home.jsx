import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Briefcase, Clock, FileText, UsersThree, ChartLine, Wrench,
  FolderOpen, GearSix, CaretRight, Coin, SunHorizon, ShieldCheck,
} from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function Home() {
  const { profile, fullName, isAdmin, user } = useAuth()
  const firstName = (fullName || profile?.email || '').split(' ')[0] || ''

  const [stats, setStats] = useState({ projects: 0, monthHours: 0, openOffers: 0 })

  useEffect(() => {
    if (!user) return
    loadStats()
  }, [user])

  async function loadStats() {
    try {
      const monthStart = new Date()
      monthStart.setDate(1)
      const fromStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`

      const [projects, hours, offers] = await Promise.all([
        supabase.from('project_records').select('id', { count: 'exact', head: true }).eq('status', 'aktiv'),
        supabase.from('time_entries').select('stunden').eq('user_id', user.id).gte('datum', fromStr),
        supabase.from('pv_offers').select('id', { count: 'exact', head: true }).eq('status', 'entwurf'),
      ])
      const monthHours = (hours.data || []).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
      setStats({
        projects: projects.count || 0,
        monthHours: Math.round(monthHours * 10) / 10,
        openOffers: offers.count || 0,
      })
    } catch {
      // silent
    }
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 11) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  const userTiles = [
    {
      to: '/zeiterfassung', label: 'Zeiterfassung', desc: 'Stunden eintragen',
      Icon: Clock, gradient: 'from-blue-500 to-indigo-600',
    },
    {
      to: '/projekte', label: 'Projekte', desc: 'Baustellen verwalten',
      Icon: Briefcase, gradient: 'from-orange-400 to-orange-600',
    },
    {
      to: '/regiearbeiten', label: 'Regiearbeiten', desc: 'Service-Einsätze',
      Icon: Wrench, gradient: 'from-purple-500 to-fuchsia-600',
    },
    {
      to: '/angebote', label: 'PV-Angebote', desc: 'Kalkulation & PDF',
      Icon: SunHorizon, gradient: 'from-emerald-500 to-teal-600',
    },
    {
      to: '/meine-stunden', label: 'Meine Stunden', desc: 'Bilanz & Übersicht',
      Icon: ChartLine, gradient: 'from-amber-500 to-orange-500',
    },
    {
      to: '/meine-dokumente', label: 'Meine Dokumente', desc: 'Lohnzettel & Co.',
      Icon: FolderOpen, gradient: 'from-sky-500 to-blue-600',
    },
  ]

  const adminTiles = [
    {
      to: '/admin', label: 'Admin-Übersicht', desc: 'Zentrales Admin-Dashboard',
      Icon: ShieldCheck, gradient: 'from-rose-600 to-red-700',
    },
    {
      to: '/auswertung', label: 'Stundenauswertung', desc: 'Analyse & Excel-Export',
      Icon: ChartLine, gradient: 'from-rose-500 to-pink-600',
    },
    {
      to: '/mitarbeiter', label: 'Mitarbeiter', desc: 'Team verwalten',
      Icon: UsersThree, gradient: 'from-teal-500 to-cyan-600',
    },
    {
      to: '/zulagen', label: 'Zulagen', desc: 'Taggeld & Co. konfigurieren',
      Icon: Coin, gradient: 'from-yellow-500 to-amber-600',
    },
    {
      to: '/angebote/material', label: 'PV-Material', desc: 'Produkt-Katalog',
      Icon: Wrench, gradient: 'from-cyan-500 to-blue-600',
    },
    {
      to: '/einstellungen', label: 'Einstellungen', desc: 'App & Profil',
      Icon: GearSix, gradient: 'from-gray-500 to-slate-600',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 pb-10">
      {/* Greeting Hero */}
      <div className="mb-5">
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-medium">{greeting}</p>
        <h1 className="text-2xl font-bold text-secondary mt-0.5">
          {firstName ? `Hallo, ${firstName}` : 'Willkommen'}
          <span className="text-primary">.</span>
        </h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <StatCard
          label="Projekte aktiv"
          value={stats.projects}
          color="text-primary"
          to="/projekte"
        />
        <StatCard
          label="Stunden Monat"
          value={stats.monthHours.toFixed(1)}
          unit="h"
          color="text-blue-600"
          to="/meine-stunden"
        />
        <StatCard
          label="Offene Angebote"
          value={stats.openOffers}
          color="text-emerald-600"
          to="/angebote"
        />
      </div>

      {/* User Tiles Grid */}
      <h2 className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-semibold mb-2.5 px-0.5">Bereiche</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {userTiles.map(t => <Tile key={t.to} {...t} />)}
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <>
          <div className="mt-8 mb-2.5 flex items-center gap-3">
            <p className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-semibold">Administration</p>
            <div className="h-px bg-gray-200 flex-1" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {adminTiles.map(t => <Tile key={t.to} {...t} />)}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color, to }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl border border-gray-100 p-2.5 active:scale-[0.97] transition-transform block"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <p className="text-[9px] text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-xl font-bold ${color} mt-0.5 leading-tight`}>
        {value}
        {unit && <span className="text-xs text-gray-400 font-medium ml-0.5">{unit}</span>}
      </p>
    </Link>
  )
}

function Tile({ to, label, desc, Icon, gradient }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl border border-gray-100 p-4 transition-all duration-200 active:scale-[0.97] block group relative overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      {/* Gradient Background Decor */}
      <div
        className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br ${gradient} group-hover:opacity-20 transition-opacity`}
      />

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm relative z-10`}>
        <Icon size={20} weight="fill" className="text-white" />
      </div>

      {/* Text */}
      <div className="relative z-10">
        <p className="text-[14px] font-semibold text-secondary leading-tight">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
      </div>

      {/* Arrow */}
      <CaretRight
        size={14}
        weight="bold"
        className="absolute bottom-3 right-3 text-gray-200 group-hover:text-primary transition-colors"
      />
    </Link>
  )
}
