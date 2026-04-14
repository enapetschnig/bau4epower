import { useState } from 'react'
import { Trash, Copy, Check, PencilSimple, X, SpinnerGap } from '@phosphor-icons/react'
import InlineMicButton from './InlineMicButton.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { callClaude, parseJsonResponse } from '../lib/claude.js'

const FORMAT_PROMPT = `Bereinige den folgenden gesprochenen Text für ein Bauangebot. Teile ihn in einzelne Punkte auf. Halte dich dabei SEHR NAH am Originaltext – ändere nur Grammatik, Rechtschreibung und mache aus Umgangssprache korrektes Deutsch. NICHT umformulieren, NICHT ergänzen, NICHT interpretieren, KEINE eigenen Inhalte hinzufügen. Nur aufräumen was gesagt wurde.

ANTWORTE NUR MIT JSON:
{"punkte": ["Punkt 1", "Punkt 2", "Punkt 3"]}

Beispiel-Input: 'der Zugang zur Baustelle muss durch den Schlüssel organisiert werden und die Baustelle wird in zwei Phasen gemacht'

Beispiel-Output: {"punkte": ["Der Zugang zur Baustelle muss durch Schlüsselübergabe organisiert werden.", "Die Baustelle wird in zwei Phasen durchgeführt."]}

NUR JSON, keine Erklärung.`

export default function ErgaenzungenEditor({ ergaenzungen = [], onChange }) {
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
        onChange([...ergaenzungen, ...punkte])
      } else {
        onChange([...ergaenzungen, punkte[0] || trimmed])
      }
    } catch {
      onChange([...ergaenzungen, trimmed])
    } finally {
      setFormatting(false)
    }
  }

  function deleteEntry(idx) {
    onChange(ergaenzungen.filter((_, i) => i !== idx))
  }

  function startEdit(idx) {
    setEditingIdx(idx)
    setEditText(ergaenzungen[idx])
  }

  function saveEdit() {
    if (editingIdx === null) return
    const trimmed = editText.trim()
    if (!trimmed) { deleteEntry(editingIdx); setEditingIdx(null); return }
    const next = [...ergaenzungen]
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
    if (ergaenzungen.length === 0) return
    const text = ergaenzungen.map((e, i) => `${i + 1}. ${e}`).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        showToast('Ergänzungen kopiert!')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => showToast('Kopieren fehlgeschlagen', 'error'))
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-secondary text-sm">{ergaenzungen.length === 1 ? 'Ergänzung' : 'Ergänzungen'}</h3>
        {ergaenzungen.length > 0 && (
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
      {ergaenzungen.length > 0 && (
        <ul className="space-y-2">
          {ergaenzungen.map((e, idx) => (
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
                  <span className="text-xs font-bold text-primary mt-0.5 flex-shrink-0">{idx + 1}.</span>
                  <span className="text-xs font-semibold text-primary mt-0.5 flex-shrink-0">Ergänzung:</span>
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
          title="Ergänzung per Sprache hinzufügen"
          disabled={formatting}
        />
        <input
          className="input-field flex-1 text-sm py-2 disabled:opacity-50"
          placeholder="Ergänzung hinzufügen..."
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
