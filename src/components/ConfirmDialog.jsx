import { Trash } from '@phosphor-icons/react'

/**
 * Einfacher Bestätigungsdialog (Bottom Sheet).
 * Props: title, message, confirmLabel, onConfirm, onCancel
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Ja, löschen', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
        <p className="font-semibold text-secondary text-center">{title}</p>
        {message && <p className="text-sm text-gray-400 text-center">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 py-2.5 text-sm"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:bg-red-600 flex items-center justify-center gap-2"
          >
            <Trash size={15} weight="fill" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
