import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MagnifyingGlass, MapPin, Briefcase, X, SpinnerGap, CaretRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects, createProject } from '../lib/projectRecords.js'

export default function Projekte() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('aktiv')
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

        <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
          {[
            { v: 'aktiv', l: 'Aktiv' },
            { v: 'inaktiv', l: 'Inaktiv' },
            { v: 'alle', l: 'Alle' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
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
            {search ? 'Keine Projekte gefunden' : 'Noch keine Projekte angelegt'}
          </p>
          {!search && (
            <button onClick={() => setShowNew(true)} className="btn-primary mt-3 inline-flex">
              <Plus size={14} weight="bold" />
              Erstes Projekt anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Link
              key={p.id}
              to={`/projekte/${p.id}`}
              className="block bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 hover:border-primary/30 transition-all group"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                  ${p.status === 'aktiv' ? 'bg-primary-50' : 'bg-gray-100'}`}>
                  <Briefcase
                    size={20}
                    weight="fill"
                    className={p.status === 'aktiv' ? 'text-primary' : 'text-gray-400'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono font-semibold">
                      {p.projekt_nummer || '–'}
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
          ))}
        </div>
      )}

      {showNew && (
        <NewProjectDialog
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refresh() }}
          userId={user?.id}
        />
      )}
    </div>
  )
}

function NewProjectDialog({ onClose, onCreated, userId }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ kunde_name: '', adresse: '', plz: '', beschreibung: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.kunde_name.trim() && !form.adresse.trim()) {
      showToast('Bitte Kundennamen oder Adresse angeben', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await createProject({
        userId,
        kunde_name: form.kunde_name,
        name: form.kunde_name || form.adresse || 'Projekt',
        adresse: form.adresse,
        plz: form.plz,
        beschreibung: form.beschreibung,
      })
      showToast(`Projekt ${created.projekt_nummer} angelegt`)
      onCreated()
    } catch (err) {
      showToast(err.message || 'Fehler beim Anlegen', 'error')
    } finally {
      setSaving(false)
    }
  }

  const yr = new Date().getFullYear()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">Neues Projekt</h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="bg-primary-50 rounded-lg px-3 py-2 mb-3">
          <p className="text-[11px] text-gray-500">Projekt-Nummer</p>
          <p className="text-[14px] font-bold text-primary font-mono">
            {yr}xxxx <span className="text-[10px] text-gray-400 font-normal">(wird automatisch vergeben)</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="label block mb-0.5">Kundenname (optional)</label>
            <input
              autoFocus
              value={form.kunde_name}
              onChange={e => setForm({ ...form, kunde_name: e.target.value })}
              className="input-field"
              placeholder="z.B. Familie Mustermann"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Adresse</label>
            <input
              value={form.adresse}
              onChange={e => setForm({ ...form, adresse: e.target.value })}
              className="input-field"
              placeholder="Straße + Hausnummer"
            />
          </div>
          <div>
            <label className="label block mb-0.5">PLZ / Ort</label>
            <input
              value={form.plz}
              onChange={e => setForm({ ...form, plz: e.target.value })}
              className="input-field"
              placeholder="z.B. 8841 Frojach"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Beschreibung</label>
            <textarea
              value={form.beschreibung}
              onChange={e => setForm({ ...form, beschreibung: e.target.value })}
              className="input-field min-h-[60px]"
              placeholder="Optional"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full mt-3">
            {saving
              ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
              : <><Plus size={14} weight="bold" /> Projekt anlegen</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
