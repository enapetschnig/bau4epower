import { useState, useEffect } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase.js'
import {
  DEFAULT_PROMPT_1,
  DEFAULT_PROMPT_AUFGLIEDERUNG,
  DEFAULT_PROMPT_3,
  DEFAULT_PROMPT_4,
} from '../../lib/prompts.js'
import { useToast } from '../../contexts/ToastContext.jsx'

const PROMPT_CONFIGS = [
  {
    type: 1,
    label: 'Variable Kalkulation',
    description: 'Modus 1 – Einzelne Position neu kalkulieren',
    defaultPrompt: DEFAULT_PROMPT_1,
  },
  {
    type: 2,
    label: 'Aufgliederung',
    description: 'Strukturierte Punkt-Liste aus Spracheingabe',
    defaultPrompt: DEFAULT_PROMPT_AUFGLIEDERUNG,
  },
  {
    type: 3,
    label: 'Angebot generieren',
    description: 'Modus 2 – Kleines Angebot aus einer Spracheingabe',
    defaultPrompt: DEFAULT_PROMPT_3,
  },
  {
    type: 4,
    label: 'Großes Angebot',
    description: 'Modus 3 – Einzelner Gewerk-Block aus Spracheingabe',
    defaultPrompt: DEFAULT_PROMPT_4,
  },
]

function PromptEditor({ type, defaultPrompt, label, description }) {
  const [versions, setVersions] = useState([])
  const [activeVersion, setActiveVersion] = useState(null)
  const [editText, setEditText] = useState('')
  const [promptId, setPromptId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadPrompt()
  }, [type])

  async function loadPrompt() {
    try {
      const { data: prompt } = await supabase
        .from('prompts')
        .select('*, prompt_versions(*)')
        .eq('type', type)
        .single()

      if (prompt) {
        setPromptId(prompt.id)
        const sorted = (prompt.prompt_versions || []).sort((a, b) => b.version_number - a.version_number)
        setVersions(sorted)
        const active = sorted.find(v => v.version_number === prompt.active_version) || sorted[0]
        if (active) {
          setActiveVersion(active.version_number)
          setEditText(active.text)
        }
      } else {
        setEditText(defaultPrompt)
      }
    } catch {
      setEditText(defaultPrompt)
    }
  }

  async function saveVersion() {
    setSaving(true)
    try {
      let pid = promptId
      if (!pid) {
        const { data, error } = await supabase
          .from('prompts')
          .insert({ type, active_version: 1 })
          .select()
          .single()
        if (error) throw error
        pid = data.id
        setPromptId(pid)
      }

      const newVersion = versions.length > 0
        ? Math.max(...versions.map(v => v.version_number)) + 1
        : 1
      const { error: vErr } = await supabase.from('prompt_versions').insert({
        prompt_id: pid,
        version_number: newVersion,
        text: editText,
      })
      if (vErr) throw vErr
      await supabase.from('prompts').update({ active_version: newVersion }).eq('id', pid)
      showToast(`${label} – Version ${newVersion} gespeichert`)
      await loadPrompt()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(version) {
    if (!promptId) return
    try {
      await supabase.from('prompts').update({ active_version: version.version_number }).eq('id', promptId)
      setActiveVersion(version.version_number)
      setEditText(version.text)
      showToast(`Version ${version.version_number} wiederhergestellt`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function resetToDefault() {
    setEditText(defaultPrompt)
    showToast('Standard-Prompt geladen – noch nicht gespeichert', 'info')
  }

  const activeVersionObj = versions.find(v => v.version_number === activeVersion)
  const lastModified = activeVersionObj
    ? new Date(activeVersionObj.created_at).toLocaleString('de-AT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null
  const oldVersions = versions.filter(v => v.version_number !== activeVersion)

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-secondary text-base">{label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          {lastModified && (
            <p className="text-xs text-gray-400 mt-1">Zuletzt geändert: {lastModified}</p>
          )}
        </div>
        {activeVersion != null && (
          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-mono font-semibold">
            Version {activeVersion}
          </span>
        )}
      </div>

      {/* Textarea */}
      <textarea
        className="input-field resize-none font-mono text-xs w-full"
        style={{ minHeight: '300px' }}
        value={editText}
        onChange={e => setEditText(e.target.value)}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={saveVersion}
          disabled={saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button
          onClick={resetToDefault}
          className="btn-secondary px-3 text-sm"
        >
          Auf Standard zurücksetzen
        </button>
      </div>

      {/* Version history */}
      {versions.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-sm text-gray-500 py-1"
          >
            <CaretRight
              size={16}
              weight="regular"
              className={`transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`}
            />
            Versionshistorie ({versions.length} Version{versions.length !== 1 ? 'en' : ''})
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {/* Active version */}
              {activeVersionObj && (
                <div className="p-3 rounded-xl border border-primary bg-red-50 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono">v{activeVersionObj.version_number}</span>
                      <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded">aktiv</span>
                    </div>
                    <span className="text-gray-400">
                      {new Date(activeVersionObj.created_at).toLocaleDateString('de-AT', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-600 font-mono leading-relaxed line-clamp-2">
                    {activeVersionObj.text.slice(0, 100)}{activeVersionObj.text.length > 100 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Older versions */}
              {oldVersions.map(v => (
                <div key={v.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold font-mono text-gray-600">v{v.version_number}</span>
                    <span className="text-gray-400">
                      {new Date(v.created_at).toLocaleDateString('de-AT', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-500 font-mono leading-relaxed mb-2 line-clamp-2">
                    {v.text.slice(0, 100)}{v.text.length > 100 ? '…' : ''}
                  </p>
                  <button
                    onClick={() => restoreVersion(v)}
                    className="text-primary text-xs font-medium"
                  >
                    Diese Version wiederherstellen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PromptManager() {
  return (
    <div className="space-y-6">
      {PROMPT_CONFIGS.map(config => (
        <PromptEditor key={config.type} {...config} />
      ))}
    </div>
  )
}
