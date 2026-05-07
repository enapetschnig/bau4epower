import { useState, useEffect } from 'react'
import { Plus, X, SpinnerGap, Clock, Trash } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects } from '../lib/projectRecords.js'
import { createTimeEntry, loadMyTimeEntries, deleteTimeEntry } from '../lib/timeEntries.js'

const ABSENCE_TYPES = ['Urlaub', 'Krankenstand', 'Weiterbildung', 'Arztbesuch', 'Zeitausgleich']

export default function Zeiterfassung() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialForm())

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
    Promise.all([loadProjects(), loadMyTimeEntries(user.id, { from: monthStart() })])
      .then(([p, e]) => { setProjects(p.filter(x => x.status === 'aktiv')); setEntries(e) })
      .catch(() => showToast('Daten konnten nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  }, [user])

  function monthStart() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.stunden && !form.startTime) {
      showToast('Bitte Stunden oder Zeit eingeben', 'error')
      return
    }
    setSaving(true)
    try {
      let stunden = parseFloat(form.stunden) || 0
      if (!stunden && form.startTime && form.endTime) {
        const [sh, sm] = form.startTime.split(':').map(Number)
        const [eh, em] = form.endTime.split(':').map(Number)
        const diff = (eh * 60 + em - sh * 60 - sm - parseInt(form.pauseMinutes || 0)) / 60
        stunden = Math.round(diff * 100) / 100
      }
      await createTimeEntry({
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
      showToast('Eintrag gespeichert')
      setForm(initialForm())
      const fresh = await loadMyTimeEntries(user.id, { from: monthStart() })
      setEntries(fresh)
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
    } catch (err) {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + (Number(e.stunden) || 0), 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Zeiterfassung</h1>
        <span className="text-[11px] text-gray-400">
          Diesen Monat: <strong className="text-primary">{totalHours.toFixed(1)} h</strong>
        </span>
      </div>

      {/* New Entry Form */}
      <form onSubmit={handleSubmit} className="card space-y-2.5 mb-4">
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
            <div className="flex gap-px bg-gray-100 rounded-md p-0.5 h-[38px]">
              <button
                type="button"
                onClick={() => setForm({ ...form, isAbsence: false })}
                className={`flex-1 text-[12px] font-medium rounded-[5px] transition-all
                  ${!form.isAbsence ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
              >
                Arbeit
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, isAbsence: true })}
                className={`flex-1 text-[12px] font-medium rounded-[5px] transition-all
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
                <label className="label block mb-0.5">Pause (min)</label>
                <input
                  type="number"
                  value={form.pauseMinutes}
                  onChange={e => setForm({ ...form, pauseMinutes: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="label block mb-0.5">Stunden gesamt (überschreibt Zeit)</label>
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
              <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
                {[{ v: 'baustelle', l: 'Baustelle' }, { v: 'werkstatt', l: 'Werkstatt' }].map(o => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setForm({ ...form, locationType: o.v })}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
                      ${form.locationType === o.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : <><Plus size={14} weight="bold" /> Speichern</>}
        </button>
      </form>

      {/* Recent Entries */}
      <h2 className="text-[12px] font-semibold text-secondary mb-2">Diesen Monat</h2>
      {loading ? (
        <div className="flex justify-center py-6">
          <SpinnerGap size={20} className="animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6 text-[12px] text-gray-400">Noch keine Einträge diesen Monat</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map(e => (
            <div key={e.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{formatDate(e.datum)}</span>
                  {e.is_absence && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-px rounded">{e.absence_type}</span>
                  )}
                  {e.project_records && (
                    <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded truncate max-w-[120px]">
                      {e.project_records.name}
                    </span>
                  )}
                </div>
                {e.taetigkeit && <p className="text-[12px] text-secondary mt-0.5 truncate">{e.taetigkeit}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {e.start_time && e.end_time ? `${e.start_time}–${e.end_time}` : ''}
                  {e.start_time && e.pause_minutes ? ` · ${e.pause_minutes}min Pause` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[13px] font-bold text-primary">{Number(e.stunden).toFixed(2)}h</span>
                <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-500">
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(d) {
  const date = new Date(d)
  return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}
