import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { saveAufmass } from '../lib/aufmaesse.js'
import InlineMicButton from '../components/InlineMicButton.jsx'
import {
  Ruler, Plus, Trash, Wall, Door, FrameCorners,
  Drop, PaintBucket, HouseLine, Columns, Lightning, Wrench,
  CaretDown, FloppyDisk, Buildings, Stairs
} from '@phosphor-icons/react'

// ── Aufmaß-Kategorien ─────────────────────────────────────────
const KATEGORIEN = [
  { id: 'waende_decken', label: 'Wände / Decken', Icon: Wall, einheit: 'm²', felder: ['laenge', 'hoehe'] },
  { id: 'tueren', label: 'Türen', Icon: Door, einheit: 'Stk', felder: ['breite', 'hoehe'] },
  { id: 'fenster', label: 'Fenster', Icon: FrameCorners, einheit: 'Stk', felder: ['breite', 'hoehe'] },
  { id: 'fliesen', label: 'Fliesen', Icon: Drop, einheit: 'm²', felder: ['laenge', 'breite'] },
  { id: 'parkett', label: 'Parkett / Boden', Icon: PaintBucket, einheit: 'm²', felder: ['laenge', 'breite'] },
  { id: 'fassade', label: 'Fassade', Icon: Buildings, einheit: 'm²', felder: ['laenge', 'hoehe'] },
  { id: 'estrich', label: 'Estrich', Icon: Stairs, einheit: 'm²', felder: ['laenge', 'breite'] },
  { id: 'trockenbau', label: 'Trockenbau', Icon: Columns, einheit: 'm²', felder: ['laenge', 'hoehe'] },
  { id: 'elektro', label: 'Elektro', Icon: Lightning, einheit: 'Stk', felder: ['menge'] },
  { id: 'sanitaer', label: 'Sanitär', Icon: Wrench, einheit: 'Stk', felder: ['menge'] },
]

const FELD_LABELS = {
  laenge: 'Länge (m)',
  breite: 'Breite (m)',
  hoehe: 'Höhe (m)',
  menge: 'Menge',
}

function emptyMessung(katId) {
  const kat = KATEGORIEN.find(k => k.id === katId)
  const felder = {}
  ;(kat?.felder || []).forEach(f => { felder[f] = '' })
  return { id: Date.now() + Math.random(), ...felder, notiz: '' }
}

function berechneFlaeche(messung, kat) {
  if (!kat) return null
  const f = kat.felder
  if (f.includes('laenge') && f.includes('breite')) {
    const a = parseFloat(messung.laenge) || 0
    const b = parseFloat(messung.breite) || 0
    return a > 0 && b > 0 ? (a * b) : null
  }
  if (f.includes('laenge') && f.includes('hoehe')) {
    const a = parseFloat(messung.laenge) || 0
    const b = parseFloat(messung.hoehe) || 0
    return a > 0 && b > 0 ? (a * b) : null
  }
  if (f.includes('breite') && f.includes('hoehe')) {
    const a = parseFloat(messung.breite) || 0
    const b = parseFloat(messung.hoehe) || 0
    return a > 0 && b > 0 ? (a * b) : null
  }
  if (f.includes('menge')) {
    return parseFloat(messung.menge) || null
  }
  return null
}

// ── Hauptkomponente ───────────────────────────────────────────
export default function Aufmass({ embedded = false }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Meta-Felder
  const [projektnummer, setProjektnummer] = useState('')
  const [adresse, setAdresse] = useState('')
  const [betrifft, setBetrifft] = useState('')

  // Gruppierung
  const [gruppierung, setGruppierung] = useState('raum') // 'raum' | 'gewerk'

  // Räume (bei Raum-Gruppierung)
  const [raeume, setRaeume] = useState([
    { id: Date.now(), name: '', messungen: {} }
  ])

  // Gewerk-Messungen (bei Gewerk-Gruppierung)
  const [gewerkMessungen, setGewerkMessungen] = useState({})

  // Aktive Kategorie
  const [activeKat, setActiveKat] = useState(null)

  // Saving
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)

  // ── Raum-Funktionen ────────────────────────────────────────
  function addRaum() {
    setRaeume(prev => [...prev, { id: Date.now(), name: '', messungen: {} }])
  }

  function updateRaumName(raumId, name) {
    setRaeume(prev => prev.map(r => r.id === raumId ? { ...r, name } : r))
  }

  function removeRaum(raumId) {
    setRaeume(prev => prev.filter(r => r.id !== raumId))
  }

  function addMessungToRaum(raumId, katId) {
    setRaeume(prev => prev.map(r => {
      if (r.id !== raumId) return r
      const existing = r.messungen[katId] || []
      return { ...r, messungen: { ...r.messungen, [katId]: [...existing, emptyMessung(katId)] } }
    }))
  }

  function updateMessungInRaum(raumId, katId, messungId, field, value) {
    setRaeume(prev => prev.map(r => {
      if (r.id !== raumId) return r
      const list = (r.messungen[katId] || []).map(m =>
        m.id === messungId ? { ...m, [field]: value } : m
      )
      return { ...r, messungen: { ...r.messungen, [katId]: list } }
    }))
  }

  function removeMessungFromRaum(raumId, katId, messungId) {
    setRaeume(prev => prev.map(r => {
      if (r.id !== raumId) return r
      const list = (r.messungen[katId] || []).filter(m => m.id !== messungId)
      return { ...r, messungen: { ...r.messungen, [katId]: list } }
    }))
  }

  // ── Gewerk-Funktionen ──────────────────────────────────────
  function addMessungToGewerk(katId) {
    setGewerkMessungen(prev => ({
      ...prev,
      [katId]: [...(prev[katId] || []), { ...emptyMessung(katId), raum: '' }]
    }))
  }

  function updateMessungInGewerk(katId, messungId, field, value) {
    setGewerkMessungen(prev => ({
      ...prev,
      [katId]: (prev[katId] || []).map(m =>
        m.id === messungId ? { ...m, [field]: value } : m
      )
    }))
  }

  function removeMessungFromGewerk(katId, messungId) {
    setGewerkMessungen(prev => ({
      ...prev,
      [katId]: (prev[katId] || []).filter(m => m.id !== messungId)
    }))
  }

  // ── Spracheingabe parsen ───────────────────────────────────
  function parseVoiceInput(text) {
    // Versuche Maße aus Sprache zu extrahieren
    // z.B. "Wohnzimmer Wand 4,5 Meter lang 2,7 Meter hoch"
    const numbers = text.match(/(\d+[,.]?\d*)/g) || []
    const parsed = numbers.map(n => parseFloat(n.replace(',', '.')))
    return { text, numbers: parsed }
  }

  // ── Gesamtfläche berechnen ─────────────────────────────────
  function getGesamtflaeche(katId) {
    let total = 0
    const kat = KATEGORIEN.find(k => k.id === katId)

    if (gruppierung === 'raum') {
      raeume.forEach(r => {
        ;(r.messungen[katId] || []).forEach(m => {
          const f = berechneFlaeche(m, kat)
          if (f) total += f
        })
      })
    } else {
      ;(gewerkMessungen[katId] || []).forEach(m => {
        const f = berechneFlaeche(m, kat)
        if (f) total += f
      })
    }
    return total
  }

  // ── Speichern ──────────────────────────────────────────────
  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const aufmassData = {
        gruppierung,
        kategorien: KATEGORIEN.map(k => k.id),
        raeume: gruppierung === 'raum' ? raeume.map(r => ({
          name: r.name,
          messungen: r.messungen,
        })) : [],
        gewerkMessungen: gruppierung === 'gewerk' ? gewerkMessungen : {},
        zusammenfassung: KATEGORIEN.reduce((acc, kat) => {
          acc[kat.id] = { gesamt: getGesamtflaeche(kat.id), einheit: kat.einheit }
          return acc
        }, {}),
      }

      const result = await saveAufmass({
        userId: user.id,
        projektnummer,
        adresse,
        betrifft,
        aufmassData,
      })

      setSavedId(result.id)
      showToast('Aufmaß gespeichert!')
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Render: Messung-Zeile ──────────────────────────────────
  function MessungZeile({ messung, katId, onUpdate, onRemove, showRaum = false }) {
    const kat = KATEGORIEN.find(k => k.id === katId)
    const flaeche = berechneFlaeche(messung, kat)

    return (
      <div className="flex flex-col gap-2 bg-gray-50 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {showRaum && (
            <input
              type="text"
              placeholder="Raum..."
              value={messung.raum || ''}
              onChange={e => onUpdate(messung.id, 'raum', e.target.value)}
              className="input-field flex-1 min-w-[100px] !min-h-[40px] !py-2 text-sm"
            />
          )}
          {(kat?.felder || []).map(f => (
            <input
              key={f}
              type="number"
              step="0.01"
              placeholder={FELD_LABELS[f]}
              value={messung[f] || ''}
              onChange={e => onUpdate(messung.id, f, e.target.value)}
              className="input-field w-24 flex-shrink-0 !min-h-[40px] !py-2 text-sm text-center"
            />
          ))}
          {flaeche !== null && (
            <span className="text-sm font-semibold text-primary whitespace-nowrap px-2">
              = {flaeche.toFixed(2)} {kat?.einheit}
            </span>
          )}
          <button onClick={() => onRemove(messung.id)} className="touch-btn text-gray-300 active:text-red-500 transition-colors flex-shrink-0">
            <Trash size={18} weight="regular" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Notiz..."
            value={messung.notiz || ''}
            onChange={e => onUpdate(messung.id, 'notiz', e.target.value)}
            className="input-field flex-1 !min-h-[36px] !py-1.5 text-xs"
          />
          <InlineMicButton
            onResult={text => {
              const { numbers } = parseVoiceInput(text)
              // Fülle Felder mit erkannten Zahlen
              const felder = kat?.felder || []
              felder.forEach((f, i) => {
                if (numbers[i] !== undefined) onUpdate(messung.id, f, numbers[i].toString())
              })
              // Rest als Notiz
              if (text) onUpdate(messung.id, 'notiz', text)
            }}
            onError={msg => showToast(msg, 'error')}
            title="Maße per Sprache"
          />
        </div>
      </div>
    )
  }

  // ── Render: Kategorie-Block ────────────────────────────────
  function KategorieBlock({ katId, messungen, onAdd, onUpdate, onRemove, showRaum = false }) {
    const kat = KATEGORIEN.find(k => k.id === katId)
    if (!kat) return null
    const gesamt = messungen.reduce((sum, m) => sum + (berechneFlaeche(m, kat) || 0), 0)

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <kat.Icon size={18} weight="regular" className="text-primary" />
            <span className="text-sm font-semibold">{kat.label}</span>
            {gesamt > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {gesamt.toFixed(2)} {kat.einheit}
              </span>
            )}
          </div>
          <button onClick={onAdd} className="touch-btn text-primary active:text-primary-dark transition-colors">
            <Plus size={20} weight="bold" />
          </button>
        </div>
        {messungen.map(m => (
          <MessungZeile
            key={m.id}
            messung={m}
            katId={katId}
            onUpdate={(mid, f, v) => onUpdate(mid, f, v)}
            onRemove={onRemove}
            showRaum={showRaum}
          />
        ))}
      </div>
    )
  }

  // ── Hauptrender ────────────────────────────────────────────
  const hasData = gruppierung === 'raum'
    ? raeume.some(r => Object.values(r.messungen).some(arr => arr.length > 0))
    : Object.values(gewerkMessungen).some(arr => arr.length > 0)

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-4 space-y-4'}>
      {/* Meta-Felder */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Ruler size={22} weight="duotone" className="text-primary" />
          <h2 className="text-lg font-bold">Neues Aufmaß</h2>
        </div>
        <input
          type="text"
          placeholder="Hero Projektnummer (optional)"
          value={projektnummer}
          onChange={e => setProjektnummer(e.target.value)}
          className="input-field"
        />
        <input
          type="text"
          placeholder="Adresse"
          value={adresse}
          onChange={e => setAdresse(e.target.value)}
          className="input-field"
        />
        <input
          type="text"
          placeholder="Betrifft (z.B. Wohnung OG links)"
          value={betrifft}
          onChange={e => setBetrifft(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Gruppierung wählen */}
      <div className="card p-2">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setGruppierung('raum')}
            className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
              ${gruppierung === 'raum' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 active:bg-gray-100'}`}
          >
            <HouseLine size={22} weight={gruppierung === 'raum' ? 'fill' : 'regular'} />
            <span className="text-xs font-medium">Nach Räumen</span>
          </button>
          <button
            onClick={() => setGruppierung('gewerk')}
            className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
              ${gruppierung === 'gewerk' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 active:bg-gray-100'}`}
          >
            <Columns size={22} weight={gruppierung === 'gewerk' ? 'fill' : 'regular'} />
            <span className="text-xs font-medium">Nach Gewerken</span>
          </button>
        </div>
      </div>

      {/* ─── RAUM-ANSICHT ──────────────────────────────────── */}
      {gruppierung === 'raum' && (
        <div className="space-y-4">
          {raeume.map((raum, raumIdx) => (
            <div key={raum.id} className="card space-y-3">
              {/* Raum-Header */}
              <div className="flex items-center gap-2">
                <HouseLine size={20} weight="duotone" className="text-secondary flex-shrink-0" />
                <input
                  type="text"
                  placeholder={`Raum ${raumIdx + 1} (z.B. Wohnzimmer)`}
                  value={raum.name}
                  onChange={e => updateRaumName(raum.id, e.target.value)}
                  className="input-field flex-1 !min-h-[40px] !py-2 font-semibold"
                />
                {raeume.length > 1 && (
                  <button onClick={() => removeRaum(raum.id)} className="touch-btn text-gray-300 active:text-red-500 transition-colors flex-shrink-0">
                    <Trash size={20} weight="regular" />
                  </button>
                )}
              </div>

              {/* Kategorie-Auswahl */}
              <div className="flex flex-wrap gap-1.5">
                {KATEGORIEN.map(kat => {
                  const hasEntries = (raum.messungen[kat.id] || []).length > 0
                  return (
                    <button
                      key={kat.id}
                      onClick={() => addMessungToRaum(raum.id, kat.id)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all
                        ${hasEntries ? 'bg-primary/10 text-primary font-medium' : 'bg-gray-100 text-gray-500 active:bg-gray-200'}`}
                    >
                      <kat.Icon size={14} />
                      <span>{kat.label}</span>
                      {hasEntries && <span className="text-[10px] bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center">{(raum.messungen[kat.id] || []).length}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Messungen pro Kategorie */}
              {KATEGORIEN.filter(kat => (raum.messungen[kat.id] || []).length > 0).map(kat => (
                <KategorieBlock
                  key={kat.id}
                  katId={kat.id}
                  messungen={raum.messungen[kat.id] || []}
                  onAdd={() => addMessungToRaum(raum.id, kat.id)}
                  onUpdate={(mid, f, v) => updateMessungInRaum(raum.id, kat.id, mid, f, v)}
                  onRemove={(mid) => removeMessungFromRaum(raum.id, kat.id, mid)}
                />
              ))}
            </div>
          ))}

          {/* Raum hinzufügen */}
          <button onClick={addRaum} className="btn-secondary w-full">
            <Plus size={20} weight="bold" />
            Raum hinzufügen
          </button>
        </div>
      )}

      {/* ─── GEWERK-ANSICHT ────────────────────────────────── */}
      {gruppierung === 'gewerk' && (
        <div className="space-y-4">
          {KATEGORIEN.map(kat => {
            const messungen = gewerkMessungen[kat.id] || []
            const gesamt = getGesamtflaeche(kat.id)
            const isActive = messungen.length > 0

            return (
              <div key={kat.id} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <kat.Icon size={22} weight="duotone" className={isActive ? 'text-primary' : 'text-gray-400'} />
                    <span className={`font-semibold ${isActive ? 'text-secondary' : 'text-gray-400'}`}>{kat.label}</span>
                    {gesamt > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {gesamt.toFixed(2)} {kat.einheit}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => addMessungToGewerk(kat.id)}
                    className="touch-btn text-primary active:text-primary-dark transition-colors"
                  >
                    <Plus size={22} weight="bold" />
                  </button>
                </div>

                {messungen.map(m => (
                  <MessungZeile
                    key={m.id}
                    messung={m}
                    katId={kat.id}
                    onUpdate={(mid, f, v) => updateMessungInGewerk(kat.id, mid, f, v)}
                    onRemove={(mid) => removeMessungFromGewerk(kat.id, mid)}
                    showRaum
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── ZUSAMMENFASSUNG ───────────────────────────────── */}
      {hasData && (
        <div className="card space-y-2">
          <h3 className="font-bold text-sm text-secondary">Zusammenfassung</h3>
          {KATEGORIEN.filter(kat => getGesamtflaeche(kat.id) > 0).map(kat => (
            <div key={kat.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <kat.Icon size={16} />
                <span>{kat.label}</span>
              </div>
              <span className="font-semibold text-secondary">
                {getGesamtflaeche(kat.id).toFixed(2)} {kat.einheit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── SPEICHERN ─────────────────────────────────────── */}
      {savedId ? (
        <div className="card bg-green-50 border-green-200 text-center space-y-3">
          <p className="text-green-700 font-semibold">Aufmaß gespeichert!</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSavedId(null)
                setProjektnummer('')
                setAdresse('')
                setBetrifft('')
                setRaeume([{ id: Date.now(), name: '', messungen: {} }])
                setGewerkMessungen({})
              }}
              className="btn-secondary flex-1"
            >
              Neues Aufmaß
            </button>
            <button
              onClick={() => navigate(`/aufmass/${savedId}`)}
              className="btn-primary flex-1"
            >
              Aufmaß ansehen
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving || !hasData}
          className="btn-primary w-full"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Speichern...
            </span>
          ) : (
            <>
              <FloppyDisk size={20} weight="bold" />
              Aufmaß speichern
            </>
          )}
        </button>
      )}
    </div>
  )
}
