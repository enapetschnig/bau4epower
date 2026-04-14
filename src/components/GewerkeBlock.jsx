import { useState } from 'react'
import { ArrowsClockwise, Trash, CaretDown } from '@phosphor-icons/react'
import PositionCard from './PositionCard.jsx'
import InlineMicButton from './InlineMicButton.jsx'

export default function GewerkeBlock({ gewerk, onDelete, onRegenerate, onEditGewerk, onEditPosition, editDisabled = false, onUndo, onUndoPosition, getPositionId }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!gewerk) return null

  return (
    <div className="card p-0 overflow-hidden">
      {/* Block Header */}
      <div
        className="flex items-center justify-between p-4 bg-secondary text-white cursor-pointer active:bg-secondary/90"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <h3 className="font-bold text-base">{gewerk.name}</h3>
          <p className="text-xs text-gray-300 mt-0.5">
            {gewerk.positionen?.length || 0} Positionen · {Number(gewerk.zwischensumme || 0).toFixed(2)} € netto
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onEditGewerk && (
            <InlineMicButton
              onResult={onEditGewerk}
              onError={() => {}}
              disabled={editDisabled}
              title="Gewerk bearbeiten"
            />
          )}
          {onRegenerate && (
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerate() }}
              className="touch-btn text-gray-300 active:text-white transition-colors"
              title="Neu generieren"
            >
              <ArrowsClockwise size={20} weight="regular" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="touch-btn text-gray-300 active:text-red-400 transition-colors"
              title="Block löschen"
            >
              <Trash size={20} weight="regular" />
            </button>
          )}
          <CaretDown
            size={20}
            weight="regular"
            className={`text-gray-300 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </div>
      </div>

      {/* Positions */}
      {!collapsed && (
        <div className="p-3 space-y-3">
          {(gewerk.positionen || []).map((pos, pIdx) => (
            <PositionCard
              key={`${pIdx}_${pos._rev || 0}`}
              position={pos}
              onEdit={onEditPosition ? (text) => onEditPosition(pIdx, text) : undefined}
              editDisabled={editDisabled}
              onUndo={onUndoPosition ? () => onUndoPosition(pIdx) : undefined}
              positionId={getPositionId ? getPositionId(pIdx) : undefined}
            />
          ))}
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-secondary">Zwischensumme</span>
            <span className="text-base font-bold text-primary">
              {Number(gewerk.zwischensumme || 0).toFixed(2)} € netto
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
