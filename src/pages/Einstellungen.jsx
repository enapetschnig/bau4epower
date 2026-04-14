import { useState, useEffect } from 'react'
import { Gear, Trash, SpinnerGap, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useCatalog } from '../hooks/useCatalog.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { useSettings } from '../hooks/useSettings.js'
import { loadEmpfaenger, deleteEmpfaenger } from '../lib/empfaenger.js'
import PromptManager from './Admin/PromptManager.jsx'
import UserManager from './Admin/UserManager.jsx'

function SettingsContent() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { stundensaetze, activeVersion } = useCatalog()
  const { showToast } = useToast()
  const { settings, loading: settingsLoading, updateSetting } = useSettings()
  const [aufschlagGesamt, setAufschlagGesamt] = useState('')
  const [aufschlagMaterial, setAufschlagMaterial] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [empfaenger, setEmpfaenger] = useState([])
  const [empfaengerLoading, setEmpfaengerLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!user) return
    setEmpfaengerLoading(true)
    loadEmpfaenger(user.id)
      .then(setEmpfaenger)
      .finally(() => setEmpfaengerLoading(false))
  }, [user])

  async function handleDeleteEmpfaenger(id) {
    setDeletingId(id)
    try {
      await deleteEmpfaenger(id)
      setEmpfaenger(prev => prev.filter(e => e.id !== id))
      showToast('Empfänger gelöscht')
    } catch {
      showToast('Fehler beim Löschen', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!settingsLoading) {
      setAufschlagGesamt(String(settings.aufschlag_gesamt_prozent))
      setAufschlagMaterial(String(settings.aufschlag_material_prozent))
    }
  }, [settingsLoading, settings])

  async function handleSaveSettings() {
    const g = Number(aufschlagGesamt)
    const m = Number(aufschlagMaterial)
    if (isNaN(g) || isNaN(m) || g < 0 || m < 0) {
      showToast('Bitte gültige Prozentwerte eingeben', 'error')
      return
    }
    setSavingSettings(true)
    try {
      await updateSetting('aufschlag_gesamt_prozent', g)
      await updateSetting('aufschlag_material_prozent', m)
      showToast('Aufschläge gespeichert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-secondary">Mein Profil</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label block mb-1">Name</span>
            <p className="text-sm font-medium">{profile?.name || '–'}</p>
          </div>
          <div>
            <span className="label block mb-1">E-Mail</span>
            <p className="text-sm font-medium truncate">{profile?.email || '–'}</p>
          </div>
          <div>
            <span className="label block mb-1">Rolle</span>
            <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full
              ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
              {isAdmin ? 'Admin' : 'Bauleiter'}
            </span>
          </div>
        </div>
      </div>

      {/* Kalkulations-Aufschläge (nur Admin) */}
      {isAdmin && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Gear size={18} weight="fill" className="text-secondary" />
            <h2 className="font-semibold text-secondary">Kalkulations-Aufschläge</h2>
          </div>
          <p className="text-xs text-gray-400">Gelten nur für KI-neu-kalkulierte Positionen (nicht für Katalogpreise)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Aufschlag Gesamt (%)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={aufschlagGesamt}
                onChange={e => setAufschlagGesamt(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Aufschlag Material (%)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={aufschlagMaterial}
                onChange={e => setAufschlagMaterial(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings || settingsLoading}
            className="btn-primary w-full text-sm py-2 disabled:opacity-50"
          >
            {savingSettings ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      )}

      {/* Stundensätze */}
      <div className="card">
        <h2 className="font-semibold text-secondary mb-1">Stundensätze (€/Std netto)</h2>
        {activeVersion && (
          <p className="text-xs text-gray-400 mb-3">aus: {activeVersion.name}</p>
        )}
        {Object.keys(stundensaetze).length > 0 ? (
          <div className="grid gap-2">
            {Object.entries(stundensaetze).map(([gewerk, satz]) => (
              <div key={gewerk} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{gewerk}</span>
                <span className="text-sm font-semibold text-secondary">{satz} €/Std</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Keine Preisliste geladen – Stundensätze werden aus Excel-Import erkannt.</p>
        )}
      </div>

      {/* Gespeicherte Empfänger */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-secondary">Gespeicherte Empfänger</h2>
        <p className="text-xs text-gray-400">E-Mail-Adressen die beim PDF-Versand gespeichert wurden</p>
        {empfaengerLoading ? (
          <div className="flex justify-center py-3">
            <SpinnerGap size={20} weight="bold" className="text-gray-300 animate-spin" />
          </div>
        ) : empfaenger.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Empfänger gespeichert</p>
        ) : (
          <div className="space-y-1">
            {empfaenger.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-secondary truncate">{e.email}</p>
                  {e.name && <p className="text-xs text-gray-400">{e.name}</p>}
                </div>
                <button
                  onClick={() => handleDeleteEmpfaenger(e.id)}
                  disabled={deletingId === e.id}
                  className="text-gray-300 active:text-red-400 p-1.5 flex-shrink-0 transition-colors"
                >
                  {deletingId === e.id
                    ? <SpinnerGap size={14} className="animate-spin" />
                    : <Trash size={14} weight="regular" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="card">
        <h2 className="font-semibold text-secondary mb-3">App-Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">KI-Modell</span>
            <span className="font-medium">claude-sonnet-4-20250514</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Spracheingabe</span>
            {import.meta.env.VITE_OPENAI_API_KEY?.length > 10 ? (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                OpenAI Whisper
              </span>
            ) : (
              <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                Web Speech API
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">MwSt</span>
            <span className="font-medium">20% (Österreich)</span>
          </div>
        </div>
      </div>

      <button onClick={signOut} className="btn-secondary w-full text-red-500 border-red-200">
        Abmelden
      </button>
    </div>
  )
}

function AdminContent() {
  const [activeTab, setActiveTab] = useState('prompts')

  return (
    <div className="space-y-4">
      <div className="card p-2">
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'prompts', label: 'Prompts' },
            { id: 'users', label: 'Benutzer' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl transition-all text-sm font-medium
                ${activeTab === tab.id ? 'bg-secondary text-white' : 'text-gray-500 active:bg-gray-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'prompts' && <PromptManager />}
      {activeTab === 'users' && <UserManager />}
    </div>
  )
}

export default function Einstellungen() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('settings')

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Tab Selector – only show if admin */}
      {isAdmin && (
        <div className="card p-2">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setTab('settings')}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
                ${tab === 'settings'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-100'
                }`}
            >
              <Gear size={22} weight={tab === 'settings' ? 'fill' : 'regular'} />
              <span className="text-xs font-medium">Einstellungen</span>
            </button>
            <button
              onClick={() => setTab('admin')}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
                ${tab === 'admin'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-100'
                }`}
            >
              <ShieldCheck size={22} weight={tab === 'admin' ? 'fill' : 'regular'} />
              <span className="text-xs font-medium">Admin</span>
            </button>
          </div>
        </div>
      )}

      {tab === 'settings' && <SettingsContent />}
      {tab === 'admin' && isAdmin && <AdminContent />}
    </div>
  )
}
