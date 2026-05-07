import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlass, CaretDown, X, Plus, Briefcase, Check } from '@phosphor-icons/react'

/**
 * Suchbares Projekt-Dropdown.
 *
 * Props:
 *   projects: Project[]
 *   value: projectId | ''
 *   onChange: (id) => void
 *   onCreateNew: () => void  (optional - zeigt "+ Neues Projekt" Eintrag)
 *   placeholder: string
 */
export default function ProjectCombobox({
  projects = [],
  value,
  onChange,
  onCreateNew,
  placeholder = 'Projekt suchen oder auswählen...',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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
  const filtered = !q
    ? projects
    : projects.filter(p =>
        (p.projekt_nummer || '').toLowerCase().includes(q) ||
        (p.kunde_name || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.adresse || '').toLowerCase().includes(q)
      )

  function handleSelect(id) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {/* Display Button */}
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

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {/* Search */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
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
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {/* "Kein Projekt" Option */}
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
              filtered.map(p => (
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono font-semibold">
                        {p.projekt_nummer}
                      </span>
                      {p.status !== 'aktiv' && (
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-px rounded">{p.status}</span>
                      )}
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
              ))
            )}
          </div>

          {/* Create New */}
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
