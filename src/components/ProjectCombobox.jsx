import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlass, CaretDown, X, Plus, Briefcase, Check, Lightning, SunHorizon, Wrench } from '@phosphor-icons/react'
import { GEWERKE, gewerkKurz } from '../lib/projectRecords.js'

const GEWERK_ICONS = {
  elektro: { Icon: Lightning, color: 'text-amber-600', bg: 'bg-amber-100' },
  pv: { Icon: SunHorizon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  installateur: { Icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100' },
}

export default function ProjectCombobox({
  projects = [],
  value,
  onChange,
  onCreateNew,
  placeholder = 'Projekt suchen oder auswählen...',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Default: alle Gewerke anzeigen - User kann selbst filtern
  const [filterGewerk, setFilterGewerk] = useState('alle')
  const ref = useRef(null)
  const inputRef = useRef(null)

  const selected = projects.find(p => p.id === value)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = projects.filter(p => {
    if (filterGewerk !== 'alle' && p.gewerk !== filterGewerk) return false
    if (!q) return true
    return (
      (p.projekt_nummer || '').toLowerCase().includes(q) ||
      (p.kunde_name || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.adresse || '').toLowerCase().includes(q)
    )
  })

  function handleSelect(id) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const selCfg = selected ? GEWERK_ICONS[selected.gewerk] : null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field w-full text-left flex items-center justify-between gap-2"
      >
        <span className="flex-1 truncate flex items-center gap-2">
          {selected ? (
            <>
              <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono font-semibold flex-shrink-0">
                {selected.projekt_nummer}
              </span>
              {selCfg && (
                <selCfg.Icon size={12} weight="fill" className={`${selCfg.color} flex-shrink-0`} />
              )}
              <span className="text-secondary truncate">
                {selected.kunde_name || selected.name || ''}
              </span>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        {value ? (
          <span
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="text-gray-300 hover:text-red-500 flex-shrink-0 p-0.5 cursor-pointer"
          >
            <X size={12} weight="bold" />
          </span>
        ) : (
          <CaretDown size={12} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 space-y-2">
            <div className="relative">
              <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Suchen nach Nr., Name oder Adresse..."
                className="w-full bg-white border border-gray-200 rounded-md pl-7 pr-2 py-1.5 text-[12px] focus:outline-none focus:border-primary"
              />
            </div>

            {/* Gewerk-Filter Chips */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => setFilterGewerk('alle')}
                className={`py-1 text-[10px] font-semibold rounded transition-colors
                  ${filterGewerk === 'alle' ? 'bg-secondary text-white' : 'bg-white text-gray-400 border border-gray-200'}`}
              >
                Alle
              </button>
              {GEWERKE.map(g => {
                const cfg = GEWERK_ICONS[g.v]
                const active = filterGewerk === g.v
                return (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setFilterGewerk(g.v)}
                    className={`py-1 text-[10px] font-semibold rounded transition-colors flex items-center justify-center gap-1
                      ${active ? `${cfg.bg} ${cfg.color}` : 'bg-white text-gray-400 border border-gray-200'}`}
                  >
                    <cfg.Icon size={10} weight="fill" />
                    {g.kurz}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors text-[12px] text-gray-400 italic flex items-center gap-2
                ${!value ? 'bg-primary-50' : ''}`}
            >
              {!value && <Check size={12} weight="bold" className="text-primary" />}
              <span className={!value ? 'ml-0' : 'ml-4'}>– kein Projekt –</span>
            </button>

            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Briefcase size={20} className="mx-auto mb-1 text-gray-200" />
                <p className="text-[11px] text-gray-400">Keine Projekte gefunden</p>
              </div>
            ) : (
              filtered.map(p => {
                const cfg = GEWERK_ICONS[p.gewerk] || GEWERK_ICONS.elektro
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-start gap-2
                      ${value === p.id ? 'bg-primary-50' : ''}`}
                  >
                    {value === p.id ? (
                      <Check size={12} weight="bold" className="text-primary mt-1 flex-shrink-0" />
                    ) : (
                      <span className="w-3 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono font-semibold">
                          {p.projekt_nummer}
                        </span>
                        <span className={`text-[9px] ${cfg.bg} ${cfg.color} px-1 py-px rounded font-medium flex items-center gap-0.5`}>
                          <cfg.Icon size={9} weight="fill" />
                          {gewerkKurz(p.gewerk)}
                        </span>
                      </div>
                      {p.kunde_name && (
                        <p className="text-[12px] font-semibold text-secondary truncate">{p.kunde_name}</p>
                      )}
                      {p.name && p.name !== p.kunde_name && (
                        <p className="text-[11px] text-gray-500 truncate">{p.name}</p>
                      )}
                      {p.adresse && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {p.plz ? `${p.plz} ` : ''}{p.adresse}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {onCreateNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew() }}
              className="border-t border-gray-100 px-3 py-2.5 bg-gray-50 hover:bg-primary-50 text-[12px] font-semibold text-primary flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} weight="bold" />
              Neues Projekt anlegen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
