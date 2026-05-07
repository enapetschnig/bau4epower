import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MagnifyingGlass, MapPin, Briefcase, X, SpinnerGap, CaretRight, Lightning, SunHorizon, Wrench } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects, GEWERKE, gewerkLabel, gewerkKurz } from '../lib/projectRecords.js'
import ProjectDialog from '../components/ProjectDialog.jsx'

const GEWERK_ICONS = {
  elektro: { Icon: Lightning, color: 'text-amber-600', bg: 'bg-amber-100' },
  pv: { Icon: SunHorizon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  installateur: { Icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100' },
}

export default function Projekte() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('aktiv')
  const [filterGewerk, setFilterGewerk] = useState('alle')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const data = await loadProjects()
      setProjects(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const filtered = projects.filter(p => {
    if (filter !== 'alle' && p.status !== filter) return false
    if (filterGewerk !== 'alle' && p.gewerk !== filterGewerk) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (p.projekt_nummer || '').toLowerCase().includes(s) ||
      (p.kunde_name || '').toLowerCase().includes(s) ||
      (p.name || '').toLowerCase().includes(s) ||
      (p.adresse || '').toLowerCase().includes(s) ||
      (p.plz || '').toLowerCase().includes(s)
    )
  })

  // Counts pro Gewerk
  const gewerkCounts = projects.reduce((acc, p) => {
    if (filter === 'alle' || p.status === filter) {
      acc[p.gewerk || 'unbekannt'] = (acc[p.gewerk || 'unbekannt'] || 0) + 1
    }
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto px-4 py-3 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-secondary">Projekte</h1>
          <p className="text-[11px] text-gray-400">{projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'} gesamt</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary px-3">
          <Plus size={14} weight="bold" />
          Neu
        </button>
      </div>

      <div className="space-y-2 mb-3">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Projektnr., Kunde, Adresse, PLZ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
            inputMode="search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>

        {/* Gewerk-Filter */}
        <div className="grid grid-cols-4 gap-1.5">
          <GewerkChip
            active={filterGewerk === 'alle'}
            onClick={() => setFilterGewerk('alle')}
            label="Alle"
            count={projects.filter(p => filter === 'alle' || p.status === filter).length}
          />
          {GEWERKE.map(g => (
            <GewerkChip
              key={g.v}
              gewerk={g.v}
              active={filterGewerk === g.v}
              onClick={() => setFilterGewerk(g.v)}
              label={g.kurz}
              count={gewerkCounts[g.v] || 0}
            />
          ))}
        </div>

        {/* Status-Filter */}
        <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
          {[
            { v: 'aktiv', l: 'Aktiv' },
            { v: 'inaktiv', l: 'Inaktiv' },
            { v: 'alle', l: 'Alle' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-[5px] transition-all
                ${filter === f.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerGap size={28} weight="bold" className="text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase size={36} weight="regular" className="mx-auto mb-2 text-gray-200" />
          <p className="text-[13px] text-gray-400">
            {search || filterGewerk !== 'alle' ? 'Keine Projekte gefunden' : 'Noch keine Projekte angelegt'}
          </p>
          {!search && filterGewerk === 'alle' && (
            <button onClick={() => setShowNew(true)} className="btn-primary mt-3 inline-flex">
              <Plus size={14} weight="bold" />
              Erstes Projekt anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const cfg = GEWERK_ICONS[p.gewerk] || GEWERK_ICONS.elektro
            return (
              <Link
                key={p.id}
                to={`/projekte/${p.id}`}
                className="block bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 hover:border-primary/30 transition-all group"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${cfg.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <cfg.Icon size={20} weight="fill" className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono font-semibold">
                        {p.projekt_nummer || '–'}
                      </span>
                      <span className={`text-[9px] ${cfg.bg} ${cfg.color} px-1.5 py-px rounded font-medium`}>
                        {gewerkKurz(p.gewerk)}
                      </span>
                      {p.status !== 'aktiv' && (
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-px rounded">{p.status}</span>
                      )}
                    </div>
                    <h3 className="text-[13px] font-semibold text-secondary truncate">
                      {p.kunde_name || p.name || 'Unbenannt'}
                    </h3>
                    {p.adresse && (
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin size={10} />
                        {p.plz ? `${p.plz} ` : ''}{p.adresse}
                      </p>
                    )}
                  </div>
                  <CaretRight size={14} className="text-gray-300 flex-shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showNew && (
        <ProjectDialog
          defaultGewerk={profile?.default_gewerk || 'elektro'}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refresh() }}
        />
      )}
    </div>
  )
}

function GewerkChip({ gewerk, active, onClick, label, count }) {
  const cfg = gewerk ? GEWERK_ICONS[gewerk] : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 rounded-lg border-2 transition-all
        ${active
          ? cfg
            ? `${cfg.bg} border-current ${cfg.color}`
            : 'bg-primary-50 border-primary text-primary'
          : 'bg-white border-gray-200 text-gray-400'}`}
    >
      {cfg && <cfg.Icon size={14} weight="fill" className={active ? cfg.color : 'text-gray-300'} />}
      <span className="text-[10px] font-semibold mt-0.5">{label}</span>
      {count !== undefined && (
        <span className="text-[9px] opacity-70">{count}</span>
      )}
    </button>
  )
}
