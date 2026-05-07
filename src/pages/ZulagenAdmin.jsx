import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Trash, PencilSimple, X, SpinnerGap, Coin, ToggleLeft, ToggleRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadAllZulagen, createZulage, updateZulage, deleteZulage, ABRECHNUNGSARTEN } from '../lib/zulagen.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function ZulagenAdmin() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)

  if (!isAdmin) return <Navigate to="/" replace />

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const data = await loadAllZulagen()
      setItems(data)
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Zulage wirklich löschen? Bestehende Einträge mit dieser Zulage werden nicht gelöscht.')) return
    try {
      await deleteZulage(id)
      setItems(prev => prev.filter(z => z.id !== id))
      showToast('Gelöscht')
    } catch (err) {
      showToast(err.message || 'Löschen fehlgeschlagen', 'error')
    }
  }

  async function handleToggleActive(z) {
    try {
      await updateZulage(z.id, { is_active: !z.is_active })
      setItems(prev => prev.map(x => x.id === z.id ? { ...x, is_active: !z.is_active } : x))
    } catch {
      showToast('Aktualisierung fehlgeschlagen', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader
        title="Zulagen verwalten"
        subtitle="Taggeld, Schmutzzulage, Kilometergeld..."
        backTo="/einstellungen"
        action={
          <button onClick={() => setShowNew(true)} className="btn-primary px-3">
            <Plus size={14} weight="bold" />
            Neu
          </button>
        }
      />

      <div className="px-4 pt-3">
        <p className="text-[12px] text-gray-400 mb-3">
          Hier definierst du Zulagen, die Mitarbeiter bei der Zeiterfassung auswählen können.
          Die Zulagen werden automatisch in der Auswertung berücksichtigt.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <SpinnerGap size={28} className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Coin size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[13px] text-gray-400">Noch keine Zulagen angelegt</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mt-3 inline-flex">
              <Plus size={14} weight="bold" />
              Erste Zulage anlegen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(z => {
              const art = ABRECHNUNGSARTEN.find(a => a.v === z.abrechnungsart)
              return (
                <div key={z.id} className={`bg-white rounded-lg border p-3 transition-opacity
                  ${z.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[13px] font-semibold text-secondary truncate">{z.name}</p>
                        {!z.is_active && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-px rounded">inaktiv</span>
                        )}
                      </div>
                      {z.beschreibung && (
                        <p className="text-[11px] text-gray-500 mb-1">{z.beschreibung}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-primary">
                          {Number(z.default_betrag).toLocaleString('de-AT', { minimumFractionDigits: 2 })} {z.einheit}
                        </span>
                        <span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[10px] text-gray-500">{art?.l || z.abrechnungsart}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(z)}
                        className="touch-btn text-gray-400"
                        title={z.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {z.is_active
                          ? <ToggleRight size={20} weight="fill" className="text-primary" />
                          : <ToggleLeft size={20} weight="regular" />}
                      </button>
                      <button onClick={() => setEditing(z)} className="touch-btn text-gray-400">
                        <PencilSimple size={14} />
                      </button>
                      <button onClick={() => handleDelete(z.id)} className="touch-btn text-gray-300 hover:text-red-500">
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(showNew || editing) && (
        <ZulageDialog
          zulage={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}

function ZulageDialog({ zulage, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: zulage?.name || '',
    beschreibung: zulage?.beschreibung || '',
    default_betrag: zulage?.default_betrag || '',
    einheit: zulage?.einheit || 'EUR',
    abrechnungsart: zulage?.abrechnungsart || 'pro_tag',
    is_active: zulage?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        default_betrag: parseFloat(form.default_betrag) || 0,
      }
      if (zulage) {
        await updateZulage(zulage.id, payload)
      } else {
        await createZulage(payload)
      }
      showToast('Gespeichert')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentArt = ABRECHNUNGSARTEN.find(a => a.v === form.abrechnungsart)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">
            {zulage ? 'Zulage bearbeiten' : 'Neue Zulage'}
          </h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="label block mb-0.5">Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="z.B. Taggeld Inland"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Beschreibung</label>
            <input
              value={form.beschreibung}
              onChange={e => setForm({ ...form, beschreibung: e.target.value })}
              className="input-field"
              placeholder="Kurze Erklärung..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Standard-Betrag</label>
              <input
                type="number"
                step="0.01"
                value={form.default_betrag}
                onChange={e => setForm({ ...form, default_betrag: e.target.value })}
                className="input-field"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label block mb-0.5">Einheit</label>
              <select
                value={form.einheit}
                onChange={e => setForm({ ...form, einheit: e.target.value })}
                className="input-field"
              >
                <option>EUR</option>
                <option>EUR/km</option>
                <option>EUR/Std</option>
                <option>%</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label block mb-0.5">Abrechnungsart *</label>
            <select
              value={form.abrechnungsart}
              onChange={e => setForm({ ...form, abrechnungsart: e.target.value })}
              className="input-field"
            >
              {ABRECHNUNGSARTEN.map(a => (
                <option key={a.v} value={a.v}>{a.l} – {a.desc}</option>
              ))}
            </select>
            {currentArt && (
              <p className="text-[10px] text-gray-400 mt-1">{currentArt.desc}</p>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-primary" />
            <span className="text-[12px] text-secondary">Aktiv (Mitarbeiter können diese Zulage auswählen)</span>
          </label>

          <button type="submit" disabled={saving} className="btn-primary w-full mt-3">
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
