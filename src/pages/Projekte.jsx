import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MagnifyingGlass, MapPin, Briefcase, X, SpinnerGap } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects, createProject, deleteProject, updateProject } from '../lib/projectRecords.js'

export default function Projekte() {
  const { user, isAdmin } = useAuth()
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
    } catch (err) {
      showToast('Projekte konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = projects.filter(p => {
    if (filter !== 'alle' && p.status !== filter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (p.name || '').toLowerCase().includes(s) || (p.adresse || '').toLowerCase().includes(s)
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Projekte</h1>
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
            placeholder="Projekt suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
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
        <div className="text-center py-12 text-[13px] text-gray-400">
          <Briefcase size={36} weight="regular" className="mx-auto mb-2 text-gray-200" />
          {search ? 'Keine Projekte gefunden' : 'Noch keine Projekte angelegt'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Link
              key={p.id}
              to={`/projekte/${p.id}`}
              className="block bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 transition-colors"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-semibold text-secondary truncate">{p.name}</h3>
                  {p.adresse && (
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                      <MapPin size={11} />
                      {p.plz ? `${p.plz} ` : ''}{p.adresse}
                    </p>
                  )}
                  {p.beschreibung && (
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{p.beschreibung}</p>
                  )}
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
                  ${p.status === 'aktiv' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {p.status}
                </span>
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
  const [form, setForm] = useState({ name: '', adresse: '', plz: '', beschreibung: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await createProject({ userId, ...form })
      showToast('Projekt angelegt')
      onCreated()
    } catch (err) {
      showToast(err.message || 'Fehler beim Anlegen', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">Neues Projekt</h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="label block mb-0.5">Projektname *</label>
            <input
              required
              autoFocus
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="z.B. Bürohaus Mustermann"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Adresse</label>
            <input
              type="text"
              value={form.adresse}
              onChange={e => setForm({ ...form, adresse: e.target.value })}
              className="input-field"
              placeholder="Straße + Hausnummer"
            />
          </div>
          <div>
            <label className="label block mb-0.5">PLZ / Ort</label>
            <input
              type="text"
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
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Anlegen'}
          </button>
        </form>
      </div>
    </div>
  )
}
