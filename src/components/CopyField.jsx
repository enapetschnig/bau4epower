import { useState } from 'react'
import { ClipboardText, Check } from '@phosphor-icons/react'
import { useToast } from '../contexts/ToastContext.jsx'

export default function CopyField({ label, value, onChange, placeholder, format = 'text', multiline = false }) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  function getDisplayValue() {
    if (value === null || value === undefined) return '–'
    if (format === 'currency') return `${Number(value).toFixed(2)} €`
    if (format === 'percent') return `${Number(value).toFixed(1)} %`
    if (format === 'number') return String(value)
    return String(value)
  }

  function getCopyValue() {
    if (value === null || value === undefined) return ''
    if (format === 'currency') return Number(value).toFixed(2)
    if (format === 'percent') return Number(value).toFixed(1)
    return String(value)
  }

  async function handleCopy() {
    const text = getCopyValue()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast(`"${label}" kopiert!`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Kopieren fehlgeschlagen', 'error')
    }
  }

  // Editable mode (wenn onChange übergeben)
  if (onChange) {
    return (
      <div className="flex flex-col gap-1">
        <span className="label">{label}</span>
        <div className={`copy-field transition-all ${copied ? 'bg-green-50 border border-green-200' : ''}`}>
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || '–'}
            className="flex-1 text-sm font-medium text-secondary bg-transparent outline-none min-w-0"
          />
          <button onClick={handleCopy} className="touch-btn flex-shrink-0 ml-1">
            {copied
              ? <Check size={16} weight="bold" className="text-green-500" />
              : <ClipboardText size={16} weight="regular" className="text-gray-300" />
            }
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <button
        onClick={handleCopy}
        className={`copy-field text-left transition-all ${copied ? 'bg-green-50 border border-green-200' : ''}`}
      >
        <span className={`flex-1 text-sm font-medium text-secondary ${multiline ? 'whitespace-normal break-words' : 'truncate'}`}>{getDisplayValue()}</span>
        {copied
          ? <Check size={16} weight="bold" className="text-green-500 flex-shrink-0" />
          : <ClipboardText size={16} weight="regular" className="text-gray-300 flex-shrink-0" />
        }
      </button>
    </div>
  )
}
