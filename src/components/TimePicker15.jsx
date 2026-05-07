import { useState, useRef, useEffect } from 'react'
import { Clock, CaretDown } from '@phosphor-icons/react'

/**
 * Time-Picker mit echten 15-Minuten-Schritten.
 * Generiert eine Dropdown-Liste von startHour bis endHour, jeweils
 * im 15-Minuten-Raster (00, 15, 30, 45).
 */
export default function TimePicker15({
  value = '',
  onChange,
  startHour = 4,
  endHour = 23,
  placeholder = '--:--',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const listRef = useRef(null)

  // Generate slots
  const slots = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll selected into view when opened
  useEffect(() => {
    if (open && listRef.current && value) {
      const selected = listRef.current.querySelector(`[data-time="${value}"]`)
      if (selected) selected.scrollIntoView({ block: 'center' })
    }
  }, [open, value])

  function handleSelect(t) {
    onChange(t)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field w-full text-left flex items-center justify-between gap-1 pr-2"
      >
        <span className={`flex items-center gap-1.5 flex-1 ${value ? 'text-secondary' : 'text-gray-300'}`}>
          <Clock size={12} className="text-gray-300 flex-shrink-0" />
          <span className="font-mono text-[13px]">{value || placeholder}</span>
        </span>
        <CaretDown size={11} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {slots.map(t => (
            <button
              key={t}
              type="button"
              data-time={t}
              onClick={() => handleSelect(t)}
              className={`w-full px-3 py-1.5 text-left text-[13px] font-mono hover:bg-primary-50 transition-colors
                ${value === t ? 'bg-primary text-white font-semibold hover:bg-primary' : 'text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
