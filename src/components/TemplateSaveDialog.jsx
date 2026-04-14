import { useState } from 'react'
import { BookmarkSimple, X } from '@phosphor-icons/react'

export default function TemplateSaveDialog({ onSave, onCancel, saving }) {
  const [name, setName] = useState('')

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <div className="card border border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkSimple size={18} weight="fill" className="text-primary" />
          <h3 className="font-semibold text-secondary text-sm">Vorlage speichern</h3>
        </div>
        <button onClick={onCancel} className="text-gray-400 active:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <input
        autoFocus
        className="input-field"
        placeholder='z.B. "Badsanierung komplett", "Malerarbeiten Wohnung"'
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        maxLength={100}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
        >
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm py-2 px-4">
          Abbrechen
        </button>
      </div>
    </div>
  )
}
