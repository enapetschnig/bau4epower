import { Link, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  UsersThree, Coin, Wrench, ChartLine, GearSix, ShieldCheck,
  Briefcase, Clock, FileText, Database, CaretRight, Lightning, SunHorizon,
} from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function Admin() {
  const { isAdmin, fullName } = useAuth()

  const [stats, setStats] = useState({
    employees: 0,
    activeProjects: 0,
    monthEntries: 0,
    monthHours: 0,
    pvOffers: 0,
    zulagen: 0,
    pvProducts: 0,
  })

  useEffect(() => {
    if (!isAdmin) return
    loadStats()
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function loadStats() {
    try {
      const monthStart = new Date()
      monthStart.setDate(1)
      const fromStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`

      const [emp, proj, te, pvo, zu, pvp] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('project_records').select('id', { count: 'exact', head: true }).eq('status', 'aktiv'),
        supabase.from('time_entries').select('stunden').gte('datum', fromStr),
        supabase.from('pv_offers').select('id', { count: 'exact', head: true }).eq('status', 'entwurf'),
        supabase.from('zulagen').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('pv_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ])

      const monthHours = (te.data || []).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
      setStats({
        employees: emp.count || 0,
        activeProjects: proj.count || 0,
        monthEntries: (te.data || []).length,
        monthHours: Math.round(monthHours * 10) / 10,
        pvOffers: pvo.count || 0,
        zulagen: zu.count || 0,
        pvProducts: pvp.count || 0,
      })
    } catch {
      // silent
    }
  }

  const sections = [
    {
      title: 'Mitarbeiter & Personal',
      tiles: [
        {
          to: '/mitarbeiter', label: 'Mitarbeiter-Verwaltung',
          desc: 'Stammdaten, Gewerk, IBAN, Stundenlohn',
          Icon: UsersThree, color: 'from-teal-500 to-cyan-600',
          stat: stats.employees, statLabel: 'erfasst',
        },
      ],
    },
    {
      title: 'Zeiterfassung & Auswertung',
      tiles: [
        {
          to: '/auswertung', label: 'Stundenauswertung',
          desc: 'Monatsanalyse mit Excel-Export, Überstunden, Zulagen',
          Icon: ChartLine, color: 'from-rose-500 to-pink-600',
          stat: stats.monthHours, statLabel: 'h diesen Monat',
        },
        {
          to: '/zulagen', label: 'Zulagen-Definitionen',
          desc: 'Taggeld, Schmutzzulage, Kilometergeld...',
          Icon: Coin, color: 'from-amber-500 to-yellow-600',
          stat: stats.zulagen, statLabel: 'aktive Zulagen',
        },
      ],
    },
    {
      title: 'Projekte & Gewerke',
      tiles: [
        {
          to: '/projekte', label: 'Alle Projekte',
          desc: 'Übersicht aller Baustellen mit Filter nach Gewerk',
          Icon: Briefcase, color: 'from-orange-400 to-orange-600',
          stat: stats.activeProjects, statLabel: 'aktive Projekte',
        },
      ],
    },
    {
      title: 'PV-Angebote',
      tiles: [
        {
          to: '/angebote', label: 'PV-Angebote',
          desc: 'Alle Angebote anzeigen & verwalten',
          Icon: SunHorizon, color: 'from-emerald-500 to-teal-600',
          stat: stats.pvOffers, statLabel: 'in Entwurf',
        },
        {
          to: '/angebote/material', label: 'PV-Material-Katalog',
          desc: 'Module, Wechselrichter, Speicher, Preise',
          Icon: Database, color: 'from-cyan-500 to-blue-600',
          stat: stats.pvProducts, statLabel: 'Produkte',
        },
        {
          to: '/foerderungen', label: 'PV-Förderungen',
          desc: 'Bundes-, Landes- und Sonderförderungen pflegen',
          Icon: Coin, color: 'from-emerald-600 to-green-700',
        },
      ],
    },
    {
      title: 'System',
      tiles: [
        {
          to: '/einstellungen', label: 'App-Einstellungen',
          desc: 'Profil, Empfänger, Aufschläge',
          Icon: GearSix, color: 'from-gray-500 to-slate-600',
        },
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-10">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
          <ShieldCheck size={22} weight="fill" className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-secondary">Administration</h1>
          <p className="text-[12px] text-gray-400">Vollzugriff für {fullName || 'Administrator'}</p>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        <Stat label="Mitarbeiter" value={stats.employees} />
        <Stat label="Projekte" value={stats.activeProjects} />
        <Stat label="Std. Monat" value={stats.monthHours.toFixed(0)} unit="h" />
        <Stat label="Einträge" value={stats.monthEntries} />
        <Stat label="PV-Angebote" value={stats.pvOffers} />
        <Stat label="Zulagen" value={stats.zulagen} />
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.title}>
            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-2.5 px-0.5">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {section.tiles.map(t => <AdminTile key={t.to} {...t} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, unit }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-2.5 text-center"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <p className="text-[9px] text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className="text-base font-bold text-primary mt-0.5">
        {value}
        {unit && <span className="text-[10px] text-gray-400 font-medium ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function AdminTile({ to, label, desc, Icon, color, stat, statLabel }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl border border-gray-100 p-4 transition-all duration-200 active:scale-[0.97] block group relative overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div
        className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-10 bg-gradient-to-br ${color} group-hover:opacity-20 transition-opacity`}
      />

      <div className="flex items-start gap-3 relative z-10">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon size={20} weight="fill" className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-secondary leading-tight">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
          {stat !== undefined && (
            <p className="text-[11px] mt-1.5">
              <strong className="text-primary text-[13px]">{stat}</strong>
              {statLabel && <span className="text-gray-400 ml-1">{statLabel}</span>}
            </p>
          )}
        </div>
        <CaretRight size={14} weight="bold" className="text-gray-200 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}
