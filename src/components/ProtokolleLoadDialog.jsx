import { useState, useEffect } from 'react'
import { X, ClipboardText, SpinnerGap } from '@phosphor-icons/react'
import { loadProtokolle } from '../lib/protokolle.js'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return (
    d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
  )
}

function buildInputText(p, nurZusatzleistungen) {
  const betrifft = nurZusatzleistungen ? `Nachtrag: ${p.betrifft || ''}` : (p.betrifft || '')

  const parts = []
  if (p.hero_projektnummer) parts.push(`Projekt: ${p.hero_projektnummer}`)
  if (p.adresse) parts.push(`Adresse: ${p.adresse}`)
  if (betrifft) parts.push(`Betrifft: ${betrifft}`)
  const header = parts.join('. ')

  // Prefer KI-generated punkte from protokoll_data, fallback to raw eintraege
  const allePunkte = p.protokoll_data?.punkte?.length > 0
    ? p.protokoll_data.punkte
    : (p.eintraege || []).map(e => ({ thema: e.thema, beschreibung: e.beschreibung, ist_zusatzleistung: e.ist_zusatzleistung }))

  const gefiltert = nurZusatzleistungen
    ? allePunkte.filter(pt => pt.ist_zusatzleistung)
    : allePunkte

  const punkteText = gefiltert
    .map(pt => {
      let text = pt.thema || ''
      if (pt.beschreibung) text += ' - ' + pt.beschreibung
      if (pt.ist_zusatzleistung) text += ' (Zusatzleistung)'
      return '. ' + text
    })
    .join('\n')

  return header + (punkteText ? '\n' + punkteText : '')
}

export default function ProtokolleLoadDialog({ onLoad, onClose }) {
  const [protokolle, setProtokolle] = useState([])
  const [loading, setLoading] = useState(true)
  const [nurZusatz, setNurZusatz] = useState(false)

  useEffect(() => {
    loadProtokolle()
      .then(setProtokolle)
      .catch(() => setProtokolle([]))
      .finally(() => setLoading(false))
  }, [])

  function handleLoad(p) {
    const betrifft = nurZusatz ? `Nachtrag: ${p.betrifft || ''}` : (p.betrifft || '')
    onLoad({
      projektnummer: p.hero_projektnummer || '',
      adresse: p.adresse || '',
      betrifft,
      inputText: buildInputText(p, nurZusatz),
    })
  }

  return (
    <div className="card border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardText size={18} weight="fill" className="text-secondary" />
          <h3 className="font-semibold text-secondary text-sm">Protokoll laden</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 active:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={nurZusatz}
          onChange={e => setNurZusatz(e.target.checked)}
          className="accent-primary w-4 h-4"
        />
        <span className="text-xs text-gray-500">Nur Zusatzleistungen laden</span>
      </label>

      {loading ? (
        <div className="flex justify-center py-6">
          <SpinnerGap size={24} weight="bold" className="text-gray-400 animate-spin" />
        </div>
      ) : protokolle.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Keine Protokolle vorhanden.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {protokolle.map(p => {
            const allePunkte = p.protokoll_data?.punkte?.length > 0
              ? p.protokoll_data.punkte
              : (p.eintraege || [])
            const alleCount = allePunkte.length
            const zusatzCount = allePunkte.filter(pt => pt.ist_zusatzleistung).length
            const count = nurZusatz ? zusatzCount : alleCount
            return (
              <button
                key={p.id}
                onClick={() => handleLoad(p)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 bg-white active:border-primary active:bg-primary/5 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-secondary text-sm truncate">
                    {p.betrifft || '(kein Betreff)'}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDateTime(p.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {p.hero_projektnummer && <span>Nr. {p.hero_projektnummer}</span>}
                  <span>{count} {nurZusatz ? 'Zusatzleistungen' : 'Punkte'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
