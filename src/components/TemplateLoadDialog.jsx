import { X, FileText, ClockCounterClockwise } from '@phosphor-icons/react'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function TemplateLoadDialog({ templates, loading, mode, onLoad, onClose }) {
  const filtered = templates.filter(t => !mode || t.type === mode)

  return (
    <div className="card border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} weight="fill" className="text-secondary" />
          <h3 className="font-semibold text-secondary text-sm">Vorlage laden</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 active:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Keine Vorlagen gespeichert.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filtered.map((t, idx) => {
            const inputText = t.template_data?.inputText || ''
            return (
              <button
                key={t.id}
                onClick={() => onLoad(inputText)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 bg-white active:border-primary active:bg-primary/5 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-secondary text-sm truncate">
                    <span className="text-gray-400 mr-1.5">#{idx + 1}</span>
                    {t.name}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                    <ClockCounterClockwise size={12} />
                    {formatDate(t.created_at)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                  {inputText.slice(0, 120)}{inputText.length > 120 ? '…' : ''}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
