import { useState, useEffect, useRef } from 'react'
import { Plus, X, SpinnerGap, Trash, Camera, Image as ImageIcon, Coin, CaretDown, CaretUp, Pencil } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects } from '../lib/projectRecords.js'
import { createTimeEntry, loadMyTimeEntries, deleteTimeEntry } from '../lib/timeEntries.js'
import {
  loadZulagen, addEntryZulage, removeEntryZulage, loadZulagenForEntries,
  uploadTimeEntryPhoto, loadTimeEntryPhotos, getTimeEntryPhotoUrl, deleteTimeEntryPhoto,
  calcZulageBetrag, ABRECHNUNGSARTEN,
} from '../lib/zulagen.js'

const ABSENCE_TYPES = ['Urlaub', 'Krankenstand', 'Weiterbildung', 'Arztbesuch', 'Zeitausgleich']

export default function Zeiterfassung() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const photoInputRef = useRef(null)

  const [projects, setProjects] = useState([])
  const [zulagen, setZulagen] = useState([])
  const [entries, setEntries] = useState([])
  const [entryZulagen, setEntryZulagen] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(initialForm())
  const [selectedZulagen, setSelectedZulagen] = useState({}) // {zulageId: {menge, notiz}}
  const [pendingPhotos, setPendingPhotos] = useState([]) // File-Objekte vor dem Speichern
  const [showZulagenPicker, setShowZulagenPicker] = useState(false)

  function initialForm() {
    return {
      datum: new Date().toISOString().slice(0, 10),
      projectId: '',
      taetigkeit: '',
      stunden: '',
      startTime: '',
      endTime: '',
      pauseMinutes: '0',
      locationType: 'baustelle',
      isAbsence: false,
      absenceType: '',
    }
  }

  useEffect(() => {
    if (!user) return
    init()
  }, [user])

  async function init() {
    setLoading(true)
    try {
      const [p, z, e] = await Promise.all([
        loadProjects(),
        loadZulagen(),
        loadMyTimeEntries(user.id, { from: monthStart() }),
      ])
      setProjects(p.filter(x => x.status === 'aktiv'))
      setZulagen(z)
      setEntries(e)
      // Lade Zulagen für die Einträge
      if (e.length > 0) {
        const zlist = await loadZulagenForEntries(e.map(x => x.id))
        const map = {}
        for (const item of zlist) {
          if (!map[item.time_entry_id]) map[item.time_entry_id] = []
          map[item.time_entry_id].push(item)
        }
        setEntryZulagen(map)
      }
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  function monthStart() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  function calcStunden() {
    if (!form.startTime || !form.endTime) return 0
    const [sh, sm] = form.startTime.split(':').map(Number)
    const [eh, em] = form.endTime.split(':').map(Number)
    return Math.max(0, Math.round((eh * 60 + em - sh * 60 - sm - parseInt(form.pauseMinutes || 0)) / 60 * 100) / 100)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.stunden && !form.startTime) {
      showToast('Bitte Stunden oder Zeit eingeben', 'error')
      return
    }
    setSaving(true)
    try {
      const stunden = parseFloat(form.stunden) || calcStunden()

      // 1. Zeit-Eintrag erstellen
      const entry = await createTimeEntry({
        userId: user.id,
        projectId: form.projectId || null,
        datum: form.datum,
        taetigkeit: form.taetigkeit,
        stunden,
        startTime: form.startTime,
        endTime: form.endTime,
        pauseMinutes: parseInt(form.pauseMinutes) || 0,
        locationType: form.locationType,
        isAbsence: form.isAbsence,
        absenceType: form.isAbsence ? form.absenceType : null,
      })

      // 2. Zulagen anhängen
      const zEntries = []
      for (const [zid, opts] of Object.entries(selectedZulagen)) {
        const z = zulagen.find(x => x.id === zid)
        if (!z) continue
        const betrag = calcZulageBetrag(z, opts.menge || 1, stunden)
        try {
          await addEntryZulage({
            timeEntryId: entry.id,
            zulageId: zid,
            menge: opts.menge || 1,
            betrag,
            notiz: opts.notiz || null,
          })
          zEntries.push({ ...opts, zulagen: z, time_entry_id: entry.id, betrag })
        } catch (err) {
          console.error('Zulage konnte nicht angehängt werden:', err)
        }
      }

      // 3. Fotos hochladen
      for (const file of pendingPhotos) {
        try {
          await uploadTimeEntryPhoto(entry.id, form.projectId || null, user.id, file)
        } catch (err) {
          console.error('Foto-Upload fehlgeschlagen:', err)
        }
      }

      showToast('Eintrag gespeichert')
      setForm(initialForm())
      setSelectedZulagen({})
      setPendingPhotos([])
      setShowZulagenPicker(false)
      await init()
    } catch (err) {
      showToast(err.message || 'Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eintrag wirklich löschen?')) return
    try {
      await deleteTimeEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    setPendingPhotos(prev => [...prev, ...files])
    e.target.value = ''
  }

  function removePendingPhoto(idx) {
    setPendingPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleZulage(z) {
    setSelectedZulagen(prev => {
      const next = { ...prev }
      if (next[z.id]) {
        delete next[z.id]
      } else {
        next[z.id] = { menge: 1, notiz: '' }
      }
      return next
    })
  }

  const totalHours = entries.reduce((sum, e) => sum + (Number(e.stunden) || 0), 0)
  const totalZulagen = Object.values(entryZulagen).flat().reduce((sum, z) => sum + (Number(z.betrag) || 0), 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-3 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Zeiterfassung</h1>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Diesen Monat</p>
          <p className="text-[12px]">
            <strong className="text-primary">{totalHours.toFixed(1)} h</strong>
            {totalZulagen > 0 && (
              <span className="text-gray-400 ml-2">+ {totalZulagen.toFixed(2)} € Zulagen</span>
            )}
          </p>
        </div>
      </div>

      {/* New Entry Form */}
      <form onSubmit={handleSubmit} className="card space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label block mb-0.5">Datum</label>
            <input
              type="date"
              value={form.datum}
              onChange={e => setForm({ ...form, datum: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Art</label>
            <div className="flex gap-px bg-gray-100 rounded-lg p-0.5 h-[40px]">
              <button
                type="button"
                onClick={() => setForm({ ...form, isAbsence: false })}
                className={`flex-1 text-[12px] font-medium rounded-md transition-all
                  ${!form.isAbsence ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
              >
                Arbeit
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, isAbsence: true })}
                className={`flex-1 text-[12px] font-medium rounded-md transition-all
                  ${form.isAbsence ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
              >
                Abwesend
              </button>
            </div>
          </div>
        </div>

        {form.isAbsence ? (
          <>
            <div>
              <label className="label block mb-0.5">Abwesenheitsart</label>
              <select
                value={form.absenceType}
                onChange={e => setForm({ ...form, absenceType: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Bitte wählen...</option>
                {ABSENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-0.5">Stunden</label>
              <input
                type="number"
                step="0.25"
                value={form.stunden}
                onChange={e => setForm({ ...form, stunden: e.target.value })}
                className="input-field"
                placeholder="z.B. 8"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label block mb-0.5">Projekt (optional)</label>
              <select
                value={form.projectId}
                onChange={e => setForm({ ...form, projectId: e.target.value })}
                className="input-field"
              >
                <option value="">– kein Projekt –</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-0.5">Tätigkeit</label>
              <input
                type="text"
                value={form.taetigkeit}
                onChange={e => setForm({ ...form, taetigkeit: e.target.value })}
                className="input-field"
                placeholder="Was wurde gemacht?"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label block mb-0.5">Von</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label block mb-0.5">Bis</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label block mb-0.5">Pause min</label>
                <input
                  type="number"
                  value={form.pauseMinutes}
                  onChange={e => setForm({ ...form, pauseMinutes: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label block mb-0.5">Stunden gesamt {calcStunden() > 0 && <span className="text-gray-400 normal-case">(auto: {calcStunden().toFixed(2)}h)</span>}</label>
              <input
                type="number"
                step="0.25"
                value={form.stunden}
                onChange={e => setForm({ ...form, stunden: e.target.value })}
                className="input-field"
                placeholder="oder direkt eingeben"
              />
            </div>
            <div>
              <label className="label block mb-0.5">Ort</label>
              <div className="flex gap-px bg-gray-100 rounded-lg p-0.5">
                {[{ v: 'baustelle', l: 'Baustelle' }, { v: 'werkstatt', l: 'Werkstatt' }].map(o => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setForm({ ...form, locationType: o.v })}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all
                      ${form.locationType === o.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* ZULAGEN */}
            {zulagen.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowZulagenPicker(v => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
                    <Coin size={14} weight="fill" className="text-amber-500" />
                    Zulagen
                    {Object.keys(selectedZulagen).length > 0 && (
                      <span className="bg-primary text-white text-[10px] px-1.5 py-px rounded-full">
                        {Object.keys(selectedZulagen).length}
                      </span>
                    )}
                  </span>
                  {showZulagenPicker
                    ? <CaretUp size={14} className="text-gray-400" />
                    : <CaretDown size={14} className="text-gray-400" />}
                </button>
                {showZulagenPicker && (
                  <div className="mt-2 space-y-1.5">
                    {zulagen.map(z => {
                      const sel = selectedZulagen[z.id]
                      const art = ABRECHNUNGSARTEN.find(a => a.v === z.abrechnungsart)
                      return (
                        <div key={z.id} className={`rounded-lg border p-2 transition-colors
                          ${sel ? 'bg-primary-50 border-primary/30' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!sel}
                              onChange={() => toggleZulage(z)}
                              className="w-4 h-4 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-secondary truncate">{z.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {Number(z.default_betrag).toFixed(2)} {z.einheit} · {art?.l}
                              </p>
                            </div>
                            {sel && z.abrechnungsart !== 'pro_stunde' && (
                              <input
                                type="number"
                                step="0.5"
                                value={sel.menge}
                                onChange={e => setSelectedZulagen(prev => ({
                                  ...prev,
                                  [z.id]: { ...prev[z.id], menge: parseFloat(e.target.value) || 1 }
                                }))}
                                className="input-field !w-16 !min-h-[32px] !py-1 text-center"
                                placeholder="x1"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* FOTOS – nur bei aktivem Projekt sichtbar */}
            {form.projectId && (
              <div className="border-t border-gray-100 pt-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary mb-2">
                  <Camera size={14} weight="fill" className="text-blue-500" />
                  Fotos zum Projekt
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="btn-secondary flex-1"
                  >
                    <Camera size={14} weight="fill" />
                    Foto / Datei wählen
                  </button>
                </div>
                {pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {pendingPhotos.map((file, i) => (
                      <PendingPhoto key={i} file={file} onRemove={() => removePendingPhoto(i)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : <><Plus size={14} weight="bold" /> Eintrag speichern</>}
        </button>
      </form>

      {/* Recent Entries */}
      <h2 className="text-[12px] font-semibold text-secondary mb-2 px-1">Diesen Monat</h2>
      {loading ? (
        <div className="flex justify-center py-6">
          <SpinnerGap size={20} className="animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6 text-[12px] text-gray-400">Noch keine Einträge diesen Monat</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map(e => (
            <EntryCard
              key={e.id}
              entry={e}
              zulagen={entryZulagen[e.id] || []}
              onDelete={() => handleDelete(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PendingPhoto({ file, onRemove }) {
  const [thumb, setThumb] = useState(null)
  useEffect(() => {
    const reader = new FileReader()
    reader.onloadend = () => setThumb(reader.result)
    reader.readAsDataURL(file)
  }, [file])
  return (
    <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
      {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center"
      >
        <X size={10} weight="bold" />
      </button>
    </div>
  )
}

function EntryCard({ entry, zulagen, onDelete }) {
  const zulagenSum = zulagen.reduce((s, z) => s + (Number(z.betrag) || 0), 0)
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{formatDate(entry.datum)}</span>
            {entry.is_absence && (
              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-px rounded">{entry.absence_type}</span>
            )}
            {entry.project_records && (
              <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded truncate max-w-[120px]">
                {entry.project_records.name}
              </span>
            )}
          </div>
          {entry.taetigkeit && <p className="text-[12px] text-secondary mt-0.5 truncate">{entry.taetigkeit}</p>}
          <p className="text-[10px] text-gray-400 mt-0.5">
            {entry.start_time && entry.end_time ? `${entry.start_time}–${entry.end_time}` : ''}
            {entry.start_time && entry.pause_minutes ? ` · ${entry.pause_minutes}min Pause` : ''}
          </p>
          {zulagen.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {zulagen.map(z => (
                <span key={z.id} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-px rounded">
                  {z.zulagen?.name}: {Number(z.betrag).toFixed(2)} €
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-[13px] font-bold text-primary">{Number(entry.stunden).toFixed(2)}h</span>
          {zulagenSum > 0 && <span className="text-[10px] text-amber-600">+{zulagenSum.toFixed(2)} €</span>}
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 mt-1">
            <Trash size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}
