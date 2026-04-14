import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadAufmaesse, deleteAufmass } from '../lib/aufmaesse.js'
import { Ruler, Trash, CaretRight, HouseLine, Columns } from '@phosphor-icons/react'

const STATUS_LABEL = { entwurf: 'Entwurf', abgeschlossen: 'Abgeschlossen' }
const STATUS_COLOR = { entwurf: 'bg-yellow-100 text-yellow-700', abgeschlossen: 'bg-green-100 text-green-700' }

export default function Aufmaesse({ embedded = false }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [aufmaesse, setAufmaesse] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAufmaesse()
      .then(setAufmaesse)
      .catch(err => showToast('Fehler: ' + err.message, 'error'))
      .finally(() => setLoading(false))
  }, [user])

  async function handleDelete(id) {
    if (!confirm('Aufmaß wirklich löschen?')) return
    try {
      await deleteAufmass(id)
      setAufmaesse(prev => prev.filter(a => a.id !== id))
      showToast('Aufmaß gelöscht')
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error')
    }
  }

  function getZusammenfassung(aufmass) {
    const data = aufmass.aufmass_data
    if (!data?.zusammenfassung) return ''
    const parts = Object.entries(data.zusammenfassung)
      .filter(([, v]) => v.gesamt > 0)
      .map(([, v]) => `${v.gesamt.toFixed(1)} ${v.einheit}`)
    return parts.join(' · ')
  }

  if (loading) {
    return (
      <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-6 space-y-4'}>
        <div className="text-center text-gray-400 py-12">Laden...</div>
      </div>
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-6 space-y-4'}>
      {aufmaesse.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 space-y-2">
          <Ruler size={48} weight="thin" className="mx-auto text-gray-300" />
          <p className="text-sm font-medium">Noch keine Aufmaße vorhanden</p>
          <p className="text-xs">Erstelle dein erstes Aufmaß im Tab "Neues Aufmaß"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {aufmaesse.map(a => {
            const data = a.aufmass_data || {}
            const isRaum = data.gruppierung === 'raum'
            return (
              <Link
                key={a.id}
                to={`/aufmass/${a.id}`}
                className="card flex items-center gap-3 active:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isRaum
                    ? <HouseLine size={22} weight="duotone" className="text-primary" />
                    : <Columns size={22} weight="duotone" className="text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">
                    {a.betrifft || a.adresse || 'Aufmaß ohne Titel'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {a.adresse && <span>{a.adresse} · </span>}
                    {new Date(a.created_at).toLocaleDateString('de-AT')}
                    {a.hero_projektnummer && <span> · #{a.hero_projektnummer}</span>}
                  </p>
                  {getZusammenfassung(a) && (
                    <p className="text-xs text-primary font-medium mt-0.5 truncate">{getZusammenfassung(a)}</p>
                  )}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[a.status] || STATUS_COLOR.entwurf}`}>
                  {STATUS_LABEL[a.status] || a.status}
                </span>
                <button
                  onClick={e => { e.preventDefault(); handleDelete(a.id) }}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 active:text-red-500 active:bg-red-50 transition-colors"
                  title="Aufmaß löschen"
                >
                  <Trash size={18} weight="regular" />
                </button>
                <CaretRight size={16} weight="regular" className="text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
