import { useState } from 'react'
import { Percent, CurrencyEur, ArrowsClockwise, TrendUp } from '@phosphor-icons/react'

/**
 * EndpreisAnpassung – Dialog zum Anpassen der Endpreise
 *
 * 3 Modi:
 * 1. Auf Betrag runden – proportional in Positionen (auf/ab)
 * 2. Aufschlag in % – proportional in Positionen eingerechnet
 * 3. Nachlass in % – NICHT in Positionen, als separate Zeile in Zusammenfassung
 *
 * Props:
 *   netto:        number
 *   gewerke:      array
 *   nachlass:     { percent, betrag } | null – aktiver Nachlass
 *   onApply:      (newGewerke) => void – Positionen geändert (Runden/Aufschlag)
 *   onNachlass:   ({ percent, betrag }) => void – Nachlass setzen
 *   onClose:      () => void
 */
export default function EndpreisAnpassung({ netto, gewerke, nachlass, onApply, onNachlass, onClose }) {
  const [mode, setMode] = useState(null) // 'runden' | 'aufschlag' | 'nachlass'
  const [wunschNetto, setWunschNetto] = useState('')
  const [aufschlagPercent, setAufschlagPercent] = useState('')
  const [nachlassPercent, setNachlassPercent] = useState('')

  const currentNetto = Number(netto) || 0

  // Schnell-Rundungen (aufrunden)
  function getRundungen() {
    if (currentNetto <= 0) return []
    const opts = []
    const auf100 = Math.ceil(currentNetto / 100) * 100
    if (auf100 > currentNetto) opts.push(auf100)
    const auf500 = Math.ceil(currentNetto / 500) * 500
    if (auf500 > currentNetto && !opts.includes(auf500)) opts.push(auf500)
    const auf1000 = Math.ceil(currentNetto / 1000) * 1000
    if (auf1000 > currentNetto && !opts.includes(auf1000)) opts.push(auf1000)
    return [...new Set(opts)].sort((a, b) => a - b).slice(0, 4)
  }

  /**
   * Proportionale Anpassung aller Positionen auf einen Zielbetrag.
   * VK × Menge = Gesamtpreis (immer konsistent).
   * Cent-Differenz wird auf Pauschal-Position (Menge=1) verschoben.
   */
  function applyFactor(targetNetto) {
    if (currentNetto <= 0 || targetNetto <= 0) return

    const r2 = v => Math.round(v * 100) / 100
    const faktor = targetNetto / currentNetto

    const allPos = []
    for (const g of gewerke) {
      for (const pos of (g.positionen || [])) {
        allPos.push({
          pos,
          menge: Number(pos.menge) || 1,
          altVK: Number(pos.vk_netto_einheit) || 0,
          altMat: Number(pos.materialkosten_einheit) || 0,
        })
      }
    }

    for (const item of allPos) {
      item.neuVK = r2(item.altVK * faktor)
      item.neuGesamt = r2(item.neuVK * item.menge)
    }

    let summe = r2(allPos.reduce((s, item) => s + item.neuGesamt, 0))
    let diff = r2(targetNetto - summe)

    if (diff !== 0) {
      const pauschals = allPos.filter(item => item.menge === 1)
      const target = pauschals.length > 0 ? pauschals[0] : allPos.reduce((a, b) => a.neuGesamt > b.neuGesamt ? a : b)
      const steps = Math.round(Math.abs(diff) * 100)
      const direction = diff > 0 ? 0.01 : -0.01
      for (let i = 0; i < steps; i++) {
        target.neuVK = r2(target.neuVK + direction)
      }
      target.neuGesamt = r2(target.neuVK * target.menge)
    }

    let posIdx = 0
    const newGewerke = gewerke.map(g => {
      const newPositionen = (g.positionen || []).map(pos => {
        const item = allPos[posIdx++]
        const neuVK = item.neuVK
        const neuGesamt = item.neuGesamt
        const neuMat = item.altVK > 0 ? r2((item.altMat / item.altVK) * neuVK) : 0
        const neuLohn = r2(neuVK - neuMat)
        const matProzent = neuVK > 0 ? Math.round((neuMat / neuVK) * 1000) / 10 : 0
        const lohnProzent = neuVK > 0 ? Math.round((100 - matProzent) * 10) / 10 : 0

        return {
          ...pos,
          vk_netto_einheit: neuVK,
          gesamtpreis: neuGesamt,
          materialkosten_einheit: neuMat,
          lohnkosten_einheit: neuLohn,
          materialanteil_prozent: matProzent,
          lohnanteil_prozent: lohnProzent,
        }
      })

      return {
        ...g,
        positionen: newPositionen,
        zwischensumme: r2(newPositionen.reduce((s, p) => s + (Number(p.gesamtpreis) || 0), 0)),
      }
    })

    onApply(newGewerke)
  }

  function handleRunden() {
    const target = Number(wunschNetto)
    if (!target || target <= 0) return
    applyFactor(target)
  }

  function handleAufschlag() {
    const pct = Number(aufschlagPercent)
    if (!pct || pct <= 0) return
    const target = Math.round(currentNetto * (1 + pct / 100) * 100) / 100
    applyFactor(target)
  }

  function handleNachlass() {
    const pct = Number(nachlassPercent)
    if (!pct || pct <= 0 || pct >= 100) return
    const betrag = Math.round(currentNetto * (pct / 100) * 100) / 100
    onNachlass({ percent: pct, betrag })
  }

  const rundungen = getRundungen()

  const aufschlagPreview = aufschlagPercent && Number(aufschlagPercent) > 0
    ? Math.round(currentNetto * (1 + Number(aufschlagPercent) / 100) * 100) / 100
    : null

  const nachlassPreview = nachlassPercent && Number(nachlassPercent) > 0
    ? Math.round(currentNetto * (1 - Number(nachlassPercent) / 100) * 100) / 100
    : null

  // Hauptmenü
  if (!mode) {
    return (
      <div className="card border-2 border-primary/20 space-y-3">
        <h3 className="font-bold text-secondary flex items-center gap-2">
          <ArrowsClockwise size={18} weight="bold" className="text-primary" />
          Endpreise anpassen
        </h3>
        <p className="text-xs text-gray-400">
          Aktueller Netto: <strong className="text-secondary">{currentNetto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</strong>
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setMode('runden')}
            className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-200 active:border-primary active:text-primary transition-colors"
          >
            <CurrencyEur size={22} weight="bold" />
            <span className="text-xs font-medium">Betrag runden</span>
          </button>
          <button
            onClick={() => setMode('aufschlag')}
            className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-200 active:border-primary active:text-primary transition-colors"
          >
            <TrendUp size={22} weight="bold" />
            <span className="text-xs font-medium">Aufschlag %</span>
          </button>
          <button
            onClick={() => setMode('nachlass')}
            className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-gray-200 active:border-primary active:text-primary transition-colors"
          >
            <Percent size={22} weight="bold" />
            <span className="text-xs font-medium">Nachlass %</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full text-xs text-gray-400 py-2 active:text-gray-600"
        >
          Abbrechen
        </button>
      </div>
    )
  }

  // Runden-Modus
  if (mode === 'runden') {
    return (
      <div className="card border-2 border-primary/20 space-y-3">
        <h3 className="font-bold text-secondary flex items-center gap-2">
          <CurrencyEur size={18} weight="bold" className="text-primary" />
          Netto auf Wunschbetrag runden
        </h3>
        <p className="text-xs text-gray-400">
          Aktuell: <strong className="text-secondary">{currentNetto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</strong> ·
          Alle Positionen werden proportional angepasst.
        </p>

        {rundungen.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rundungen.map(val => (
              <button
                key={val}
                onClick={() => setWunschNetto(String(val))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  wunschNetto === String(val)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 active:border-primary'
                }`}
              >
                {val.toLocaleString('de-AT')} €
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            value={wunschNetto}
            onChange={e => setWunschNetto(e.target.value)}
            placeholder="Wunsch-Netto eingeben"
            className="input flex-1"
            min="1"
            step="1"
          />
          <span className="flex items-center text-sm text-gray-400">€ netto</span>
        </div>

        {wunschNetto && Number(wunschNetto) > 0 && Number(wunschNetto) !== currentNetto && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
            {Number(wunschNetto) > currentNetto ? (
              <>Aufschlag: <strong className="text-green-600">
                +{(Number(wunschNetto) - currentNetto).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
              </strong>
              {' '}({((Number(wunschNetto) / currentNetto - 1) * 100).toFixed(1)}% Erhöhung)</>
            ) : (
              <>Nachlass: <strong className="text-red-500">
                -{(currentNetto - Number(wunschNetto)).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
              </strong>
              {' '}({((1 - Number(wunschNetto) / currentNetto) * 100).toFixed(1)}% Reduktion)</>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setMode(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
            Zurück
          </button>
          <button
            onClick={handleRunden}
            disabled={!wunschNetto || Number(wunschNetto) <= 0 || Number(wunschNetto) === currentNetto}
            className="flex-1 btn-primary py-2.5 disabled:opacity-40"
          >
            Anpassen
          </button>
        </div>
      </div>
    )
  }

  // Aufschlag-Modus
  if (mode === 'aufschlag') {
    return (
      <div className="card border-2 border-primary/20 space-y-3">
        <h3 className="font-bold text-secondary flex items-center gap-2">
          <TrendUp size={18} weight="bold" className="text-primary" />
          Aufschlag in Prozent
        </h3>
        <p className="text-xs text-gray-400">
          Aktuell: <strong className="text-secondary">{currentNetto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</strong> ·
          Alle Positionen werden proportional erhöht.
        </p>

        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20].map(pct => (
            <button
              key={pct}
              onClick={() => setAufschlagPercent(String(pct))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                aufschlagPercent === String(pct)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 active:border-primary'
              }`}
            >
              +{pct}%
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={aufschlagPercent}
            onChange={e => setAufschlagPercent(e.target.value)}
            placeholder="Aufschlag in %"
            className="input flex-1"
            min="0.1"
            step="0.5"
          />
          <span className="flex items-center text-sm text-gray-400">%</span>
        </div>

        {aufschlagPreview && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
            Neuer Netto: <strong className="text-secondary">
              {aufschlagPreview.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
            </strong>
            {' '}(+<strong className="text-green-600">
              {(aufschlagPreview - currentNetto).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
            </strong>)
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setMode(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
            Zurück
          </button>
          <button
            onClick={handleAufschlag}
            disabled={!aufschlagPercent || Number(aufschlagPercent) <= 0}
            className="flex-1 btn-primary py-2.5 disabled:opacity-40"
          >
            Aufschlag anwenden
          </button>
        </div>
      </div>
    )
  }

  // Nachlass-Modus
  if (mode === 'nachlass') {
    const pctVal = Number(nachlassPercent) || 0
    const nachlBetrag = pctVal > 0 ? Math.round(currentNetto * (pctVal / 100) * 100) / 100 : 0
    const nachNetto = pctVal > 0 ? Math.round(currentNetto * (1 - pctVal / 100) * 100) / 100 : 0

    return (
      <div className="card border-2 border-primary/20 space-y-3">
        <h3 className="font-bold text-secondary flex items-center gap-2">
          <Percent size={18} weight="bold" className="text-primary" />
          Nachlass in Prozent
        </h3>
        <p className="text-xs text-gray-400">
          Aktuell: <strong className="text-secondary">{currentNetto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</strong> ·
          Nachlass wird als separate Zeile angezeigt (Positionen bleiben unverändert).
        </p>

        <div className="flex flex-wrap gap-2">
          {[3, 5, 10, 15].map(pct => (
            <button
              key={pct}
              onClick={() => setNachlassPercent(String(pct))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                nachlassPercent === String(pct)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 active:border-primary'
              }`}
            >
              -{pct}%
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={nachlassPercent}
            onChange={e => setNachlassPercent(e.target.value)}
            placeholder="Nachlass in %"
            className="input flex-1"
            min="0.1"
            max="99"
            step="0.5"
          />
          <span className="flex items-center text-sm text-gray-400">%</span>
        </div>

        {pctVal > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
            Netto nach Nachlass: <strong className="text-secondary">
              {nachNetto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
            </strong>
            {' '}(Ersparnis: <strong className="text-red-500">
              -{nachlBetrag.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
            </strong>)
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setMode(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
            Zurück
          </button>
          <button
            onClick={handleNachlass}
            disabled={!nachlassPercent || Number(nachlassPercent) <= 0 || Number(nachlassPercent) >= 100}
            className="flex-1 btn-primary py-2.5 disabled:opacity-40"
          >
            Nachlass anwenden
          </button>
        </div>
      </div>
    )
  }

  return null
}
