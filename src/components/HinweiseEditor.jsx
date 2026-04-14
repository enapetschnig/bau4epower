import { useState } from 'react'
import { Trash, Copy, Check, PencilSimple, X, SpinnerGap } from '@phosphor-icons/react'
import InlineMicButton from './InlineMicButton.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { callClaude, parseJsonResponse } from '../lib/claude.js'

const FORMAT_PROMPT = `Bereinige den folgenden gesprochenen Text. Es handelt sich um Hinweise an den Kunden, dass bestimmte Arbeiten auf dessen ausdrücklichen Wunsch abweichend von der fachlichen Empfehlung ausgeführt werden – auf Verantwortung und Gefahr des Kunden.
Halte dich SEHR NAH am Originaltext. Korrigiere nur Grammatik und Rechtschreibung.
Formuliere sachlich und klar. Jeder Punkt soll deutlich machen, dass dies auf Kundenwunsch und auf eigene Verantwortung des Kunden geschieht.

ANTWORTE NUR MIT JSON:
{"punkte": ["Punkt 1", "Punkt 2"]}

Beispiel-Input: 'Der Kunde will keinen Haftgrund auf die Wand, wir haben ihm gesagt das geht nicht gut aber er will es trotzdem'

Beispiel-Output: {"punkte": ["Auf ausdrücklichen Wunsch des Kunden wird auf das Auftragen einer Haftbrücke verzichtet. Der Auftragnehmer weist darauf hin, dass dies die Haftung des Putzes beeinträchtigen kann. Die Ausführung erfolgt auf Verantwortung des Kunden."]}

NUR JSON, keine Erklärung.`

export default function HinweiseEditor({ hinweise = [], onChange }) {
  const { showToast } = useToast()
  const [input, setInput] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editText, setEditText] = useState('')
  const [copied, setCopied] = useState(false)
  const [formatting, setFormatting] = useState(false)

  async function addEntry(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    setFormatting(true)
    try {
      const result = await callClaude(FORMAT_PROMPT, trimmed, null, 512)
      const data = parseJsonResponse(result)
      const punkte = Array.isArray(data?.punkte) ? data.punkte.filter(p => p?.trim()) : []
      if (punkte.length > 1) {
        onChange([...hinweise, ...punkte])
      } else {
        onChange([...hinweise, punkte[0] || trimmed])
      }
    } catch {
      onChange([...hinweise, trimmed])
    } finally {
      setFormatting(false)
    }
  }

  function deleteEntry(idx) {
    onChange(hinweise.filter((_, i) => i !== idx))
  }

  function startEdit(idx) {
    setEditingIdx(idx)
    setEditText(hinweise[idx])
  }

  function saveEdit() {
    if (editingIdx === null) return
    const trimmed = editText.trim()
    if (!trimmed) { deleteEntry(editingIdx); setEditingIdx(null); return }
    const next = [...hinweise]
    next[editingIdx] = trimmed
    onChange(next)
    setEditingIdx(null)
    setEditText('')
  }

  function cancelEdit() {
    setEditingIdx(null)
    setEditText('')
  }

  function copyAll() {
    if (hinweise.length === 0) return
    const text = hinweise.map((e, i) => `${i + 1}. ${e}`).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        showToast('Hinweise kopiert!')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => showToast('Kopieren fehlgeschlagen', 'error'))
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-secondary text-sm">{hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}</h3>
        {hinweise.length > 0 && (
          <button
            onClick={copyAll}
            className="flex items-center gap-1 text-xs text-gray-400 active:text-primary transition-colors px-2 py-1 rounded-lg active:bg-primary/10"
          >
            {copied ? <Check size={13} weight="bold" className="text-green-600" /> : <Copy size={13} weight="regular" />}
            <span>{copied ? 'Kopiert!' : 'Alle kopieren'}</span>
          </button>
        )}
      </div>

      {/* Entry list */}
      {hinweise.length > 0 && (
        <ul className="space-y-2">
          {hinweise.map((e, idx) => (
            <li key={idx} className="flex items-start gap-2 group">
              {editingIdx === idx ? (
                <div className="flex-1 flex gap-2 items-center">
                  <input
                    className="input-field flex-1 text-sm py-1.5"
                    value={editText}
                    onChange={ev => setEditText(ev.target.value)}
                    onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(); if (ev.key === 'Escape') cancelEdit() }}
                    autoFocus
                  />
                  <button onClick={saveEdit} className="touch-btn text-green-600 active:text-green-700">
                    <Check size={18} weight="bold" />
                  </button>
                  <button onClick={cancelEdit} className="touch-btn text-gray-400 active:text-gray-600">
                    <X size={18} weight="regular" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold text-yellow-600 mt-0.5 flex-shrink-0">{idx + 1}.</span>
                  <span className="text-xs font-semibold text-yellow-600 mt-0.5 flex-shrink-0">Hinweis:</span>
                  <span className="flex-1 text-sm text-gray-700 leading-snug">{e}</span>
                  <button
                    onClick={() => startEdit(idx)}
                    className="touch-btn text-gray-300 active:text-primary transition-colors flex-shrink-0"
                  >
                    <PencilSimple size={16} weight="regular" />
                  </button>
                  <button
                    onClick={() => deleteEntry(idx)}
                    className="touch-btn text-gray-300 active:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash size={16} weight="regular" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Formatting indicator */}
      {formatting && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <SpinnerGap size={14} className="animate-spin text-primary" />
          <span>KI formatiert…</span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <InlineMicButton
          onResult={text => addEntry(text)}
          onError={msg => showToast(msg, 'error')}
          title="Hinweis per Sprache hinzufügen"
          disabled={formatting}
        />
        <input
          className="input-field flex-1 text-sm py-2 disabled:opacity-50"
          placeholder="Hinweis hinzufügen..."
          value={input}
          disabled={formatting}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { addEntry(input) } }}
        />
        <button
          onClick={() => addEntry(input)}
          disabled={!input.trim() || formatting}
          className="btn-secondary text-sm px-3 py-2 disabled:opacity-40 flex-shrink-0"
        >
          +
        </button>
      </div>
    </div>
  )
}
