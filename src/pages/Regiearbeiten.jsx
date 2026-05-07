import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wrench, MagnifyingGlass, SpinnerGap, MapPin, User, Phone } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadMyDisturbances, loadAllDisturbances } from '../lib/disturbances.js'

export default function Regiearbeiten() {
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('alle')

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user, isAdmin])

  async function refresh() {
    setLoading(true)
    try {
      const data = isAdmin
        ? await loadAllDisturbances()
        : await loadMyDisturbances(user.id)
      setItems(data)
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(d => {
    if (filter === 'offen' && d.status !== 'offen') return false
    if (filter === 'verrechnet' && !d.is_verrechnet) return false
    if (filter === 'nicht-verrechnet' && d.is_verrechnet) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (d.kunde_name || '').toLowerCase().includes(s) ||
      (d.beschreibung || '').toLowerCase().includes(s) ||
      (d.kunde_adresse || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Regiearbeiten</h1>
        <Link to="/regiearbeiten/neu" className="btn-primary px-3">
          <Plus size={14} weight="bold" />
          Neu
        </Link>
      </div>

      <div className="space-y-2 mb-3">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Kunde, Adresse oder Beschreibung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
          {[
            { v: 'alle', l: 'Alle' },
            { v: 'offen', l: 'Offen' },
            { v: 'nicht-verrechnet', l: 'Nicht verrechnet' },
            { v: 'verrechnet', l: 'Verrechnet' },
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
          <Wrench size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-[13px] text-gray-400">
            {search ? 'Keine Einträge gefunden' : 'Noch keine Regiearbeiten erfasst'}
          </p>
          <Link to="/regiearbeiten/neu" className="btn-primary mt-3 inline-flex">
            <Plus size={14} weight="bold" />
            Erste Regiearbeit erfassen
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Link
              key={d.id}
              to={`/regiearbeiten/${d.id}`}
              className="block bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 transition-colors"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[13px] font-semibold text-secondary truncate flex-1">
                  {d.kunde_name || '–'}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {formatDate(d.datum)}
                  </span>
                  {d.is_verrechnet && (
                    <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-px rounded">
                      verrechnet
                    </span>
                  )}
                </div>
              </div>
              {d.kunde_adresse && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                  <MapPin size={10} />
                  {d.kunde_adresse}
                </p>
              )}
              {d.beschreibung && (
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{d.beschreibung}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                {d.stunden && <span><strong className="text-primary">{Number(d.stunden).toFixed(2)}h</strong> Arbeit</span>}
                {d.kunde_telefon && <span className="flex items-center gap-1"><Phone size={10} /> {d.kunde_telefon}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
