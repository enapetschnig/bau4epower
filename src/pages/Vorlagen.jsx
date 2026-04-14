import { useState } from 'react'
import { PencilSimple, Trash, Check, X } from '@phosphor-icons/react'
import { useTemplates } from '../hooks/useTemplates.js'
import { useToast } from '../contexts/ToastContext.jsx'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function Vorlagen({ embedded = false }) {
  const { templates, loading, update, remove } = useTemplates()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('klein')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = templates.filter(t => t.type === activeTab)

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditText(t.template_data?.inputText || '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function confirmEdit(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    try {
      await update(id, { name, inputText: editText })
      setEditingId(null)
      showToast('Vorlage gespeichert.')
    } catch {
      showToast('Fehler beim Speichern.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await remove(id)
      showToast('Vorlage gelöscht.')
    } catch {
      showToast('Fehler beim Löschen.', 'error')
    }
  }

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-4 space-y-4'}>
      <h1 className="section-title">Eingabe-Vorlagen</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'klein', label: 'Kleines Angebot' },
          { key: 'gross', label: 'Großes Angebot' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setEditingId(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? 'bg-white text-secondary shadow-sm'
                : 'text-gray-400 active:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8 space-y-2">
          <p className="text-sm text-gray-400">Noch keine Vorlagen gespeichert.</p>
          <p className="text-xs text-gray-300">
            Vorlagen können im Kalkulations-Bereich über „Eingabe als Vorlage speichern" erstellt werden.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, idx) => (
            <div key={t.id} className="card space-y-3">
              {editingId === t.id ? (
                /* Bearbeitungsansicht */
                <div className="space-y-3">
                  <div>
                    <label className="label block mb-1"><span className="text-gray-400 mr-1.5">#{idx + 1}</span>Titel</label>
                    <input
                      autoFocus
                      className="input-field"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={100}
                      onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                    />
                  </div>
                  <div>
                    <label className="label block mb-1">Inhalt</label>
                    <textarea
                      className="input-field resize-none"
                      style={{ minHeight: '180px' }}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmEdit(t.id)}
                      disabled={saving || !editName.trim()}
                      className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                    >
                      {saving ? 'Wird gespeichert…' : 'Speichern'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="btn-secondary flex-1 text-sm py-2"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                /* Listenansicht */
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary text-sm"><span className="text-gray-400 mr-1.5">#{idx + 1}</span>{t.name}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">
                      {(t.template_data?.inputText || '').slice(0, 120)}{((t.template_data?.inputText || '').length) > 120 ? '…' : ''}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">{formatDate(t.created_at)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-gray-400 active:text-secondary transition-colors p-2 rounded-lg"
                      title="Bearbeiten"
                    >
                      <PencilSimple size={16} weight="regular" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-400 active:text-red-500 transition-colors p-2 rounded-lg"
                      title="Löschen"
                    >
                      <Trash size={16} weight="regular" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
