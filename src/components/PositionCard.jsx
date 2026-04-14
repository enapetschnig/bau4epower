import { useState } from 'react'
import { ArrowCounterClockwise, Trash, CaretDown } from '@phosphor-icons/react'
import CopyField from './CopyField.jsx'
import InlineMicButton from './InlineMicButton.jsx'

export default function PositionCard({ position, onDelete, showDeleteButton = false, onEdit, editDisabled = false, onUndo, positionId }) {
  const [expanded, setExpanded] = useState(true)
  const [confirmed, setConfirmed] = useState(false)

  if (!position) return null

  const isUnsicher = position.unsicher && !confirmed

  const vkNetto = Number(position.vk_netto_einheit) || 0
  const mat = Number(position.materialkosten_einheit) || 0
  // Use stored values when explicitly set (e.g. BE has both set to 0); fall back to computed
  const materialanteilProzent = position.materialanteil_prozent != null
    ? Number(position.materialanteil_prozent)
    : (vkNetto > 0 ? Math.round((mat / vkNetto) * 1000) / 10 : 0)
  const lohnanteilProzent = position.lohnanteil_prozent != null
    ? Number(position.lohnanteil_prozent)
    : (vkNetto > 0 ? Math.round((100 - materialanteilProzent) * 10) / 10 : 0)

  return (
    <div id={positionId} className="card" style={{
      border: isUnsicher ? '3px solid #e74c3c' : '2px solid #3a3a3a',
      borderRadius: '12px',
      ...(isUnsicher ? { animation: 'unsicherBorder 1.5s ease-in-out infinite alternate', backgroundColor: '#fef2f2' } : {}),
    }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-md">
              {position.leistungsnummer}
            </span>
            {position.aus_preisliste ? (
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-md">
                aus Katalog
              </span>
            ) : (
              <span className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-md">
                Neue Leistung
              </span>
            )}
            {position.isVorschlag && (
              <span
                className="text-white text-xs font-bold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: '#27ae60',
                  animation: 'vorschlagBlink 1s ease-in-out infinite alternate',
                }}
              >
                KI-Vorschlag
              </span>
            )}
            {isUnsicher && (
              <span
                className="text-white text-xs font-bold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: '#e74c3c',
                  animation: 'unsicherBlink 0.8s ease-in-out infinite alternate',
                }}
              >
                ⚠ Prüfen
              </span>
            )}
            {position.unsicher && confirmed && (
              <span
                className="text-white text-xs font-bold px-2 py-0.5 rounded-md"
                style={{ backgroundColor: '#27ae60' }}
              >
                ✓ Bestätigt
              </span>
            )}
            {position.gewerk && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">
                {position.gewerk}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-secondary mt-1 text-sm leading-snug break-words">{position.leistungsname}</h3>
          {isUnsicher && position.hinweis && (
            <p className="text-xs text-red-600 mt-1 font-medium">⚠ {position.hinweis}</p>
          )}
          {isUnsicher && (
            <button
              onClick={() => setConfirmed(true)}
              className="mt-2 w-full py-2.5 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
              style={{ backgroundColor: '#27ae60' }}
            >
              ✓ Position passt – bestätigen
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onUndo && position.previousState && (
            <button
              onClick={onUndo}
              title="Rückgängig"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-400 active:bg-primary/15 active:text-primary transition-all flex-shrink-0"
            >
              <ArrowCounterClockwise size={14} weight="regular" />
            </button>
          )}
          {onEdit && (
            <InlineMicButton
              onResult={onEdit}
              onError={() => {}}
              disabled={editDisabled}
              title="Position bearbeiten"
            />
          )}
          {showDeleteButton && (
            <button onClick={onDelete} className="touch-btn text-gray-300 active:text-red-500 transition-colors">
              <Trash size={20} weight="regular" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="touch-btn text-gray-300 active:text-secondary transition-colors"
          >
            <CaretDown size={20} weight="regular" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Zeile 1: Leistungsnummer links, Leistungsname rechts */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CopyField label="Leistungsnummer" value={position.leistungsnummer} />
            <CopyField label="Leistungsname (Kurztext)" value={position.leistungsname} multiline />
          </div>

          {/* Zeile 2: Beschreibung volle Breite */}
          <div className="mb-3">
            <CopyField label="Beschreibung (Langtext)" value={position.beschreibung} multiline />
          </div>

          {/* Zeile 3: Menge | Einheit | VK Neu Netto / Einheit */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <CopyField label="Menge" value={position.menge} format="number" />
            <CopyField label="Einheit" value={position.einheit} />
            <CopyField label="VK Neu Netto / Einheit" value={position.vk_netto_einheit} format="currency" />
          </div>

          {/* Zeile 4: Gesamtpreis | Lohnkosten VK Netto / Einheit | Materialkosten VK Netto neu / Einheit */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <CopyField label="Gesamtpreis" value={position.gesamtpreis} format="currency" />
            <CopyField label="Lohnkosten VK Netto / Einheit" value={position.lohnkosten_einheit} format="currency" />
            <CopyField label="Materialkosten VK Netto neu / Einheit" value={position.materialkosten_einheit} format="currency" />
          </div>

          {/* Zeile 5: Lohnanteil in % | Materialanteil in % */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CopyField label="Lohnanteil in %" value={lohnanteilProzent} format="percent" />
            <CopyField label="Materialanteil in %" value={materialanteilProzent} format="percent" />
          </div>

          {/* Zeile 6: Lohnkosten Minuten / Einheit | Stundensatz */}
          <div className="grid grid-cols-2 gap-3">
            <CopyField label="Lohnkosten Minuten / Einheit" value={position.lohnkosten_minuten} format="number" />
            <CopyField label="Stundensatz" value={position.stundensatz} format="currency" />
          </div>
        </>
      )}
    </div>
  )
}
