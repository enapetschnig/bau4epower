import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SpinnerGap, Trash, Envelope } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProtokolle, deleteProtokoll, loadProtokollMediaCounts } from '../lib/protokolle.js'

const STATUS_LABEL = { entwurf: 'Entwurf', in_bearbeitung: 'In Bearbeitung', abgeschlossen: 'Abgeschlossen' }
const STATUS_COLOR = {
  entwurf: 'bg-gray-100 text-gray-500',
  in_bearbeitung: 'bg-blue-100 text-blue-600',
  abgeschlossen: 'bg-green-100 text-green-600',
}

export default function Protokolle({ embedded = false }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [protokolle, setProtokolle] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [mediaCounts, setMediaCounts] = useState({})

  useEffect(() => {
    if (!user) return
    loadProtokolle()
      .then(list => {
        setProtokolle(list)
        if (list.length > 0) {
          loadProtokollMediaCounts(list.map(p => p.id))
            .then(setMediaCounts)
            .catch(() => {})
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user])

  async function handleDelete(e, id) {
    e.preventDefault()
    e.stopPropagation()
    const confirmed = window.confirm('Protokoll wirklich löschen?')
    if (!confirmed) return
    setDeleting(id)
    try {
      await deleteProtokoll(id)
      setProtokolle(prev => prev.filter(p => p.id !== id))
      showToast('Protokoll gelöscht')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
        <SpinnerGap size={32} weight="bold" className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-4 space-y-4'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-secondary">Alle Protokolle</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{protokolle.length} gespeichert</span>
          <Link to="/besprechung" className="btn-primary text-sm py-2 px-4">+ Neu</Link>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border border-red-200 text-red-600 text-sm py-3 px-4">
          {error}
        </div>
      )}

      {!error && protokolle.length === 0 && (
        <div className="card py-12 text-center space-y-4">
          <div className="text-4xl">📋</div>
          <p className="text-gray-500 font-medium">Noch keine Protokolle gespeichert</p>
          <Link to="/besprechung" className="btn-primary inline-block">Erstes Protokoll erstellen</Link>
        </div>
      )}

      {protokolle.map(p => {
        const protokollData = p.protokoll_data || {}
        const punkte = protokollData.punkte || []
        const zusatzCount = punkte.filter(pt => pt.ist_zusatzleistung).length
        const datum = new Date(p.created_at).toLocaleDateString('de-AT', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })

        return (
          <Link
            key={p.id}
            to={`/protokoll/${p.id}`}
            className="card block space-y-2 active:border-primary border border-transparent transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-secondary text-sm truncate">
                  {p.betrifft || 'Besprechungsprotokoll'}
                </p>
                {p.hero_projektnummer && (
                  <p className="text-xs text-gray-400 mt-0.5">Projekt: {p.hero_projektnummer}</p>
                )}
                {p.adresse && (
                  <p className="text-xs text-gray-400 truncate">{p.adresse}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] || STATUS_COLOR.entwurf}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/protokoll/${p.id}`) }}
                  className="text-gray-300 active:text-primary p-1 transition-colors"
                  title="E-Mail versenden"
                >
                  <Envelope size={14} weight="regular" />
                </button>
                <button
                  onClick={e => handleDelete(e, p.id)}
                  disabled={deleting === p.id}
                  className="text-gray-300 active:text-red-400 p-1 transition-colors"
                >
                  {deleting === p.id
                    ? <SpinnerGap size={14} className="animate-spin" />
                    : <Trash size={14} weight="regular" />
                  }
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              <span>📅 {datum}</span>
              <span>📌 {punkte.length} Punkt{punkte.length !== 1 ? 'e' : ''}</span>
              {(mediaCounts[p.id] || 0) > 0 && (
                <span>📷 {mediaCounts[p.id]} Medi{mediaCounts[p.id] !== 1 ? 'en' : 'um'}</span>
              )}
              {zusatzCount > 0 && (
                <span className="text-orange-500">⚠ {zusatzCount} Zusatzleistung{zusatzCount !== 1 ? 'en' : ''}</span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
