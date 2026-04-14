import { useState, useEffect, useRef } from 'react'

/**
 * E-Mail-Eingabefeld mit Dropdown-Autocomplete aus gespeicherten Empfängern.
 * Props:
 *   value: string
 *   onChange: (value: string) => void
 *   placeholder: string
 *   empfaengerList: Array<{ id, email, name? }>
 *   disabled: boolean
 *   onKeyDown: (e) => void
 */
export default function EmailAutocomplete({
  value,
  onChange,
  placeholder = 'empfaenger@beispiel.at',
  empfaengerList = [],
  disabled = false,
  onKeyDown,
}) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState([])
  const wrapRef = useRef(null)

  useEffect(() => {
    if (value.length < 1) {
      setFiltered([])
      setOpen(false)
      return
    }
    const q = value.toLowerCase()
    const matches = empfaengerList.filter(e =>
      e.email.toLowerCase().includes(q) ||
      (e.name && e.name.toLowerCase().includes(q))
    )
    setFiltered(matches)
    setOpen(matches.length > 0)
  }, [value, empfaengerList])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(email) {
    onChange(email)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative flex-1">
      <input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field text-sm w-full"
        disabled={disabled}
        onFocus={() => { if (filtered.length > 0) setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          if (onKeyDown) onKeyDown(e)
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(e => (
            <button
              key={e.id}
              type="button"
              onMouseDown={() => select(e.email)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 active:bg-primary/5 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-secondary">{e.email}</span>
              {e.name && <span className="text-xs text-gray-400 ml-2">{e.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
