import { useState, useEffect } from 'react'
import { X, SpinnerGap, Plus, Lightning, SunHorizon, Wrench, CheckCircle, Warning } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { createProject, checkProjectNumber, GEWERKE } from '../lib/projectRecords.js'

const GEWERK_ICONS = {
  elektro: { Icon: Lightning, color: 'text-amber-600', bg: 'bg-amber-100', activeBg: 'bg-amber-500', border: 'border-amber-500' },
  pv: { Icon: SunHorizon, color: 'text-emerald-600', bg: 'bg-emerald-100', activeBg: 'bg-emerald-500', border: 'border-emerald-500' },
  installateur: { Icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100', activeBg: 'bg-blue-500', border: 'border-blue-500' },
}

export default function ProjectDialog({ onClose, onCreated, defaultGewerk = 'elektro' }) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const yr = new Date().getFullYear()
  const [nummerSuffix, setNummerSuffix] = useState('')
  const [gewerk, setGewerk] = useState(defaultGewerk)
  const [form, setForm] = useState({ kunde_name: '', adresse: '', plz: '', beschreibung: '' })
  const [saving, setSaving] = useState(false)

  // Live duplicate check
  const [checking, setChecking] = useState(false)
  const [duplicate, setDuplicate] = useState(null)

  useEffect(() => {
    if (!nummerSuffix || nummerSuffix.length !== 4) {
      setDuplicate(null)
      return
    }
    const fullNr = `${yr}${nummerSuffix}`
    setChecking(true)
    const t = setTimeout(async () => {
      try {
        const ex = await checkProjectNumber(fullNr)
        setDuplicate(ex)
      } catch {
        setDuplicate(null)
      } finally {
        setChecking(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [nummerSuffix, yr])

  const fullNummer = nummerSuffix.length === 4 ? `${yr}${nummerSuffix}` : null

  function handleSuffixChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setNummerSuffix(val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullNummer) {
      showToast('Bitte 4-stellige Projektnummer eingeben', 'error')
      return
    }
    if (duplicate) {
      showToast(`Projekt ${fullNummer} existiert bereits`, 'error')
      return
    }
    if (!form.kunde_name.trim() && !form.adresse.trim()) {
      showToast('Bitte Kundennamen oder Adresse angeben', 'error')
      return
    }
    setSaving(true)
    try {
      const project = await createProject({
        userId: user.id,
        projekt_nummer: fullNummer,
        gewerk,
        kunde_name: form.kunde_name,
        name: form.kunde_name || form.adresse || 'Projekt',
        adresse: form.adresse,
        plz: form.plz,
        beschreibung: form.beschreibung,
      })
      showToast(`Projekt ${project.projekt_nummer} angelegt`)
      onCreated(project)
    } catch (err) {
      showToast(err.message || 'Fehler beim Anlegen', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">Neues Projekt</h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Gewerk-Auswahl */}
          <div>
            <label className="label block mb-1.5">Gewerk *</label>
            <div className="grid grid-cols-3 gap-2">
              {GEWERKE.map(g => {
                const cfg = GEWERK_ICONS[g.v]
                const active = gewerk === g.v
                return (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setGewerk(g.v)}
                    className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-lg border-2 transition-all
                      ${active
                        ? `${cfg.border} ${cfg.bg}`
                        : 'border-gray-200 bg-white'}`}
                  >
                    <cfg.Icon
                      size={20}
                      weight="fill"
                      className={active ? cfg.color : 'text-gray-300'}
                    />
                    <span className={`text-[10px] font-semibold leading-tight text-center ${active ? cfg.color : 'text-gray-400'}`}>
                      {g.kurz}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Projektnummer */}
          <div>
            <label className="label block mb-1">Projektnummer *</label>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 px-3 py-2.5 rounded-lg text-[14px] font-mono font-semibold text-gray-500 select-none">
                {yr}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={nummerSuffix}
                onChange={handleSuffixChange}
                className={`input-field text-[14px] font-mono font-semibold flex-1 transition-colors
                  ${duplicate ? 'border-red-300 bg-red-50' : nummerSuffix.length === 4 && !duplicate && !checking ? 'border-green-300 bg-green-50' : ''}`}
                placeholder="0001"
                maxLength={4}
                autoFocus
              />
              <div className="w-5 flex items-center justify-center">
                {checking && <SpinnerGap size={14} className="animate-spin text-gray-400" />}
                {!checking && nummerSuffix.length === 4 && !duplicate && (
                  <CheckCircle size={16} weight="fill" className="text-green-500" />
                )}
                {duplicate && <Warning size={16} weight="fill" className="text-red-500" />}
              </div>
            </div>
            {fullNummer && (
              <p className="text-[10px] text-gray-400 mt-1 font-mono">→ {fullNummer}</p>
            )}
            {duplicate && (
              <p className="text-[11px] text-red-500 mt-1">
                Projekt {duplicate.projekt_nummer} existiert bereits ({duplicate.kunde_name || duplicate.name})
              </p>
            )}
            {nummerSuffix.length > 0 && nummerSuffix.length < 4 && (
              <p className="text-[10px] text-gray-400 mt-1">Bitte 4 Stellen eingeben</p>
            )}
          </div>

          {/* Kundenname */}
          <div>
            <label className="label block mb-0.5">Kundenname</label>
            <input
              value={form.kunde_name}
              onChange={e => setForm({ ...form, kunde_name: e.target.value })}
              className="input-field"
              placeholder="z.B. Familie Mustermann"
            />
          </div>

          <div>
            <label className="label block mb-0.5">Adresse</label>
            <input
              value={form.adresse}
              onChange={e => setForm({ ...form, adresse: e.target.value })}
              className="input-field"
              placeholder="Straße + Hausnummer"
            />
          </div>

          <div>
            <label className="label block mb-0.5">PLZ / Ort</label>
            <input
              value={form.plz}
              onChange={e => setForm({ ...form, plz: e.target.value })}
              className="input-field"
              placeholder="z.B. 8841 Frojach"
            />
          </div>

          <div>
            <label className="label block mb-0.5">Beschreibung</label>
            <textarea
              value={form.beschreibung}
              onChange={e => setForm({ ...form, beschreibung: e.target.value })}
              className="input-field min-h-[60px]"
              placeholder="Optional"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !fullNummer || !!duplicate || checking}
            className="btn-primary w-full mt-3"
          >
            {saving
              ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
              : <><Plus size={14} weight="bold" /> Projekt anlegen</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
