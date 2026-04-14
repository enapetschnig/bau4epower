import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadAufmass, deleteAufmass } from '../lib/aufmaesse.js'
import {
  Ruler, ArrowLeft, Trash, HouseLine, Columns,
  Wall, Door, FrameCorners, Drop, PaintBucket,
  Buildings, Stairs, Lightning, Wrench, ClipboardText, Copy
} from '@phosphor-icons/react'

const KATEGORIEN_MAP = {
  waende_decken: { label: 'Wände / Decken', Icon: Wall, einheit: 'm²' },
  tueren: { label: 'Türen', Icon: Door, einheit: 'Stk' },
  fenster: { label: 'Fenster', Icon: FrameCorners, einheit: 'Stk' },
  fliesen: { label: 'Fliesen', Icon: Drop, einheit: 'm²' },
  parkett: { label: 'Parkett / Boden', Icon: PaintBucket, einheit: 'm²' },
  fassade: { label: 'Fassade', Icon: Buildings, einheit: 'm²' },
  estrich: { label: 'Estrich', Icon: Stairs, einheit: 'm²' },
  trockenbau: { label: 'Trockenbau', Icon: Columns, einheit: 'm²' },
  elektro: { label: 'Elektro', Icon: Lightning, einheit: 'Stk' },
  sanitaer: { label: 'Sanitär', Icon: Wrench, einheit: 'Stk' },
}

export default function AufmassView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [aufmass, setAufmass] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAufmass(id)
      .then(setAufmass)
      .catch(err => { showToast('Fehler: ' + err.message, 'error'); navigate('/aufmass?tab=liste') })
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm('Aufmaß wirklich löschen?')) return
    try {
      await deleteAufmass(id)
      showToast('Aufmaß gelöscht')
      navigate('/aufmass?tab=liste')
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error')
    }
  }

  async function copyZusammenfassung() {
    if (!aufmass?.aufmass_data?.zusammenfassung) return
    const lines = Object.entries(aufmass.aufmass_data.zusammenfassung)
      .filter(([, v]) => v.gesamt > 0)
      .map(([k, v]) => `${KATEGORIEN_MAP[k]?.label || k}: ${v.gesamt.toFixed(2)} ${v.einheit}`)
      .join('\n')

    const text = `Aufmaß: ${aufmass.betrifft || aufmass.adresse || ''}\n${aufmass.adresse ? `Adresse: ${aufmass.adresse}\n` : ''}${aufmass.hero_projektnummer ? `Projekt: #${aufmass.hero_projektnummer}\n` : ''}\n${lines}`

    try {
      await navigator.clipboard.writeText(text)
      showToast('Zusammenfassung kopiert!')
    } catch {
      showToast('Kopieren fehlgeschlagen', 'error')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center text-gray-400 py-12">Laden...</div>
      </div>
    )
  }

  if (!aufmass) return null

  const data = aufmass.aufmass_data || {}
  const zusammenfassung = data.zusammenfassung || {}

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/aufmass?tab=liste" className="touch-btn text-gray-400 active:text-secondary transition-colors">
          <ArrowLeft size={24} weight="regular" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-secondary truncate">
            {aufmass.betrifft || aufmass.adresse || 'Aufmaß'}
          </h1>
          <p className="text-xs text-gray-400">
            {new Date(aufmass.created_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {aufmass.hero_projektnummer && ` · #${aufmass.hero_projektnummer}`}
          </p>
        </div>
        <button onClick={handleDelete} className="touch-btn text-gray-300 active:text-red-500 transition-colors">
          <Trash size={22} weight="regular" />
        </button>
      </div>

      {/* Adresse */}
      {aufmass.adresse && (
        <div className="card">
          <p className="text-xs text-gray-500 font-medium mb-1">Adresse</p>
          <p className="text-sm font-semibold">{aufmass.adresse}</p>
        </div>
      )}

      {/* Gruppierung-Info */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {data.gruppierung === 'raum'
          ? <><HouseLine size={16} /> <span>Gruppiert nach Räumen</span></>
          : <><Columns size={16} /> <span>Gruppiert nach Gewerken</span></>
        }
      </div>

      {/* Zusammenfassung */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-secondary">Zusammenfassung</h3>
          <button onClick={copyZusammenfassung} className="touch-btn text-gray-400 active:text-primary transition-colors">
            <Copy size={18} weight="regular" />
          </button>
        </div>
        {Object.entries(zusammenfassung)
          .filter(([, v]) => v.gesamt > 0)
          .map(([katId, val]) => {
            const kat = KATEGORIEN_MAP[katId]
            if (!kat) return null
            return (
              <div key={katId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <kat.Icon size={18} className="text-primary" />
                  <span>{kat.label}</span>
                </div>
                <span className="text-sm font-bold text-secondary">{val.gesamt.toFixed(2)} {val.einheit}</span>
              </div>
            )
          })
        }
      </div>

      {/* Detail-Daten: Räume */}
      {data.gruppierung === 'raum' && data.raeume?.map((raum, rIdx) => (
        <div key={rIdx} className="card space-y-2">
          <div className="flex items-center gap-2">
            <HouseLine size={18} weight="duotone" className="text-secondary" />
            <span className="font-semibold text-sm">{raum.name || `Raum ${rIdx + 1}`}</span>
          </div>
          {Object.entries(raum.messungen || {}).filter(([, arr]) => arr.length > 0).map(([katId, messungen]) => {
            const kat = KATEGORIEN_MAP[katId]
            if (!kat) return null
            return (
              <div key={katId} className="ml-6 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <kat.Icon size={14} />
                  <span>{kat.label}</span>
                </div>
                {messungen.map((m, mIdx) => (
                  <div key={mIdx} className="text-xs text-gray-600 ml-4">
                    {m.laenge && `${m.laenge}m`}{m.breite && ` × ${m.breite}m`}{m.hoehe && ` × ${m.hoehe}m`}{m.menge && `${m.menge} Stk`}
                    {m.notiz && <span className="text-gray-400 ml-2">– {m.notiz}</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}

      {/* Detail-Daten: Gewerke */}
      {data.gruppierung === 'gewerk' && Object.entries(data.gewerkMessungen || {}).filter(([, arr]) => arr.length > 0).map(([katId, messungen]) => {
        const kat = KATEGORIEN_MAP[katId]
        if (!kat) return null
        return (
          <div key={katId} className="card space-y-2">
            <div className="flex items-center gap-2">
              <kat.Icon size={18} weight="duotone" className="text-primary" />
              <span className="font-semibold text-sm">{kat.label}</span>
            </div>
            {messungen.map((m, mIdx) => (
              <div key={mIdx} className="text-xs text-gray-600 ml-6">
                {m.raum && <span className="font-medium text-secondary">{m.raum}: </span>}
                {m.laenge && `${m.laenge}m`}{m.breite && ` × ${m.breite}m`}{m.hoehe && ` × ${m.hoehe}m`}{m.menge && `${m.menge} Stk`}
                {m.notiz && <span className="text-gray-400 ml-2">– {m.notiz}</span>}
              </div>
            ))}
          </div>
        )
      })}

      {/* Zur Kalkulation */}
      <Link
        to={`/kalkulation?modus=2`}
        className="btn-primary w-full"
      >
        <ClipboardText size={20} weight="bold" />
        In Kalkulation verwenden
      </Link>
    </div>
  )
}
