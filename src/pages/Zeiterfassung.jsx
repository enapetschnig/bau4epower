import { useState, useEffect, useRef } from 'react'
import {
  Plus, X, SpinnerGap, Trash, Camera, Coin, CaretDown, CaretUp,
  Buildings, Wrench, Calendar, Clock, Check,
} from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects } from '../lib/projectRecords.js'
import { createTimeEntry, loadMyTimeEntries, deleteTimeEntry } from '../lib/timeEntries.js'
import ProjectDialog from '../components/ProjectDialog.jsx'
import {
  loadZulagen, addEntryZulage, loadZulagenForEntries,
  uploadTimeEntryPhoto, calcZulageBetrag, ABRECHNUNGSARTEN,
} from '../lib/zulagen.js'
import ProjectCombobox from '../components/ProjectCombobox.jsx'

const ABSENCE_TYPES = ['Urlaub', 'Krankenstand', 'Weiterbildung', 'Arztbesuch', 'Zeitausgleich']

function newBlock(suggestStart) {
  return {
    id: crypto.randomUUID(),
    projectId: '',
    leistung: '',
    startTime: suggestStart || '07:00',
    endTime: '',
    pauseMinutes: '0',
  }
}

export default function Zeiterfassung() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const photoInputRef = useRef(null)

  const [projects, setProjects] = useState([])
  const [zulagen, setZulagen] = useState([])
  const [entries, setEntries] = useState([])
  const [entryZulagen, setEntryZulagen] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Day-level fields
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [locationType, setLocationType] = useState('baustelle')
  const [isAbsence, setIsAbsence] = useState(false)
  const [absenceType, setAbsenceType] = useState('')
  const [absenceHours, setAbsenceHours] = useState('8')

  // Time blocks
  const [blocks, setBlocks] = useState([newBlock()])

  // Zulagen + Fotos (für ganzen Tag)
  const [selectedZulagen, setSelectedZulagen] = useState({})
  const [showZulagenPicker, setShowZulagenPicker] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])

  useEffect(() => {
    if (!user) return
    init()
  }, [user])

  async function init() {
    setLoading(true)
    try {
      const [p, z] = await Promise.all([
        loadProjects().catch(() => []),
        loadZulagen().catch(() => []),
      ])
      setProjects((p || []).filter(x => x.status === 'aktiv'))
      setZulagen(z || [])
      try {
        const e = await loadMyTimeEntries(user.id, { from: monthStart() })
        setEntries(e || [])
        if ((e || []).length > 0) {
          const zlist = await loadZulagenForEntries(e.map(x => x.id)).catch(() => [])
          const map = {}
          for (const item of zlist) {
            if (!map[item.time_entry_id]) map[item.time_entry_id] = []
            map[item.time_entry_id].push(item)
          }
          setEntryZulagen(map)
        }
      } catch {
        setEntries([])
      }
    } finally {
      setLoading(false)
    }
  }

  function monthStart() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  function calcBlockHours(b) {
    if (!b.startTime || !b.endTime) return 0
    const [sh, sm] = b.startTime.split(':').map(Number)
    const [eh, em] = b.endTime.split(':').map(Number)
    const diff = (eh * 60 + em - sh * 60 - sm - parseInt(b.pauseMinutes || 0)) / 60
    return Math.max(0, Math.round(diff * 100) / 100)
  }

  const totalDayHours = isAbsence
    ? parseFloat(absenceHours) || 0
    : blocks.reduce((s, b) => s + calcBlockHours(b), 0)

  function addBlock() {
    // Suggest next start time = previous block's end time
    const last = blocks[blocks.length - 1]
    const suggestStart = last?.endTime || '13:00'
    setBlocks(prev => [...prev, newBlock(suggestStart)])
  }

  function updateBlock(idx, field, value) {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }

  function removeBlock(idx) {
    setBlocks(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  function toggleZulage(z) {
    setSelectedZulagen(prev => {
      const next = { ...prev }
      if (next[z.id]) delete next[z.id]
      else next[z.id] = { menge: 1, notiz: '' }
      return next
    })
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    setPendingPhotos(prev => [...prev, ...files])
    e.target.value = ''
  }

  function removePendingPhoto(idx) {
    setPendingPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (isAbsence) {
      if (!absenceType) { showToast('Bitte Abwesenheitsart wählen', 'error'); return }
      if (!absenceHours || parseFloat(absenceHours) <= 0) { showToast('Bitte Stunden angeben', 'error'); return }
    } else {
      // Validate blocks
      const valid = blocks.filter(b => b.startTime && b.endTime && calcBlockHours(b) > 0)
      if (valid.length === 0) { showToast('Bitte mindestens einen Zeitblock mit Von/Bis ausfüllen', 'error'); return }
    }

    setSaving(true)
    const createdEntries = []
    try {
      if (isAbsence) {
        const entry = await createTimeEntry({
          userId: user.id,
          datum,
          stunden: parseFloat(absenceHours),
          locationType,
          isAbsence: true,
          absenceType,
        })
        createdEntries.push(entry)
      } else {
        for (const b of blocks) {
          const stunden = calcBlockHours(b)
          if (stunden <= 0) continue
          const entry = await createTimeEntry({
            userId: user.id,
            projectId: b.projectId || null,
            datum,
            taetigkeit: b.leistung,
            stunden,
            startTime: b.startTime,
            endTime: b.endTime,
            pauseMinutes: parseInt(b.pauseMinutes) || 0,
            locationType,
          })
          createdEntries.push({ ...entry, _block: b })
        }
      }

      // Zulagen → an ersten Eintrag hängen
      if (createdEntries.length > 0 && Object.keys(selectedZulagen).length > 0) {
        const firstId = createdEntries[0].id
        for (const [zid, opts] of Object.entries(selectedZulagen)) {
          const z = zulagen.find(x => x.id === zid)
          if (!z) continue
          const betrag = calcZulageBetrag(z, opts.menge || 1, totalDayHours)
          try {
            await addEntryZulage({
              timeEntryId: firstId,
              zulageId: zid,
              menge: opts.menge || 1,
              betrag,
              notiz: opts.notiz || null,
            })
          } catch (err) {
            console.error('Zulage konnte nicht angehängt werden:', err)
          }
        }
      }

      // Fotos → an Block mit passendem Projekt hängen
      if (pendingPhotos.length > 0) {
        for (const file of pendingPhotos) {
          const target = createdEntries.find(e => e.project_id) || createdEntries[0]
          if (target) {
            try {
              await uploadTimeEntryPhoto(target.id, target.project_id || null, user.id, file)
            } catch (err) {
              console.error('Foto-Upload fehlgeschlagen:', err)
            }
          }
        }
      }

      const blocksCount = createdEntries.length
      showToast(blocksCount === 1 ? 'Eintrag gespeichert' : `${blocksCount} Einträge gespeichert`)

      // Reset
      setBlocks([newBlock()])
      setSelectedZulagen({})
      setShowZulagenPicker(false)
      setPendingPhotos([])
      setIsAbsence(false)
      setAbsenceType('')
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

  const monthHours = entries.reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const monthZulagen = Object.values(entryZulagen).flat().reduce((s, z) => s + (Number(z.betrag) || 0), 0)

  // Group entries by date
  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.datum]) acc[e.datum] = []
    acc[e.datum].push(e)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto px-4 py-3 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-secondary">Zeiterfassung</h1>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Diesen Monat</p>
          <p className="text-[14px] font-bold text-primary">{monthHours.toFixed(1)} h</p>
          {monthZulagen > 0 && (
            <p className="text-[10px] text-emerald-600">+{monthZulagen.toFixed(2)} € Zulagen</p>
          )}
        </div>
      </div>

      {/* === FORM === */}
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">

        {/* Datum + Ort */}
        <div className="card space-y-3">
          <div>
            <label className="label block mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label block mb-1">Ort</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocationType('baustelle')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all
                  ${locationType === 'baustelle'
                    ? 'border-primary bg-primary-50 text-primary font-semibold'
                    : 'border-gray-200 bg-white text-gray-500'}`}
              >
                <Buildings size={16} weight="fill" />
                <span className="text-[13px]">Baustelle</span>
              </button>
              <button
                type="button"
                onClick={() => setLocationType('werkstatt')}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all
                  ${locationType === 'werkstatt'
                    ? 'border-primary bg-primary-50 text-primary font-semibold'
                    : 'border-gray-200 bg-white text-gray-500'}`}
              >
                <Wrench size={16} weight="fill" />
                <span className="text-[13px]">Firma</span>
              </button>
            </div>
          </div>

          <div>
            <label className="label block mb-1">Modus</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAbsence(false)}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all
                  ${!isAbsence
                    ? 'bg-secondary text-white'
                    : 'bg-gray-100 text-gray-500'}`}
              >
                Anwesend
              </button>
              <button
                type="button"
                onClick={() => setIsAbsence(true)}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all
                  ${isAbsence
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-500'}`}
              >
                Abwesend
              </button>
            </div>
          </div>
        </div>

        {/* === ABWESEND === */}
        {isAbsence ? (
          <div className="card space-y-3">
            <div>
              <label className="label block mb-1">Abwesenheitsart</label>
              <select
                value={absenceType}
                onChange={e => setAbsenceType(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Bitte wählen...</option>
                {ABSENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Stunden</label>
              <input
                type="number"
                step="0.25"
                value={absenceHours}
                onChange={e => setAbsenceHours(e.target.value)}
                className="input-field"
                placeholder="z.B. 8"
              />
            </div>
          </div>
        ) : (
          /* === ARBEITSBLÖCKE === */
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] font-semibold text-secondary">
                Arbeitsblöcke {blocks.length > 1 && <span className="text-gray-400 font-normal">({blocks.length})</span>}
              </p>
              <span className="text-[11px] text-gray-400">
                Tag gesamt: <strong className="text-primary">{totalDayHours.toFixed(2)} h</strong>
              </span>
            </div>

            {blocks.map((b, idx) => (
              <BlockCard
                key={b.id}
                idx={idx}
                block={b}
                blockCount={blocks.length}
                projects={projects}
                onUpdate={(field, val) => updateBlock(idx, field, val)}
                onRemove={() => removeBlock(idx)}
                hours={calcBlockHours(b)}
                onProjectCreated={(p) => setProjects(prev => [p, ...prev])}
                defaultGewerk={profile?.default_gewerk}
              />
            ))}

            <button
              type="button"
              onClick={addBlock}
              className="w-full bg-white rounded-xl border-2 border-dashed border-gray-200 py-3 text-[12px] font-semibold text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} weight="bold" />
              Weitere Baustelle / Block hinzufügen
            </button>

            {/* === ZULAGEN === */}
            {zulagen.length > 0 && (
              <div className="card">
                <button
                  type="button"
                  onClick={() => setShowZulagenPicker(v => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
                    <Coin size={14} weight="fill" className="text-amber-500" />
                    Zulagen für diesen Tag
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
                  <div className="mt-3 space-y-1.5">
                    {zulagen.map(z => {
                      const sel = selectedZulagen[z.id]
                      const art = ABRECHNUNGSARTEN.find(a => a.v === z.abrechnungsart)
                      return (
                        <div key={z.id} className={`rounded-lg border p-2 transition-colors
                          ${sel ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleZulage(z)}
                              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                                ${sel ? 'bg-primary text-white' : 'bg-gray-100 text-gray-300'}`}
                            >
                              {sel && <Check size={12} weight="bold" />}
                            </button>
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
                                onChange={ev => setSelectedZulagen(prev => ({
                                  ...prev,
                                  [z.id]: { ...prev[z.id], menge: parseFloat(ev.target.value) || 1 }
                                }))}
                                className="w-14 text-center rounded border border-gray-200 px-1 py-1 text-[12px]"
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

            {/* === FOTOS === */}
            {blocks.some(b => b.projectId) && (
              <div className="card">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary mb-2">
                  <Camera size={14} weight="fill" className="text-blue-500" />
                  Fotos zur Baustelle
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
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="btn-secondary w-full"
                >
                  <Camera size={14} weight="fill" />
                  Foto / Datei wählen
                </button>
                {pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    {pendingPhotos.map((file, i) => (
                      <PendingPhoto key={i} file={file} onRemove={() => removePendingPhoto(i)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full sticky bottom-2">
          {saving
            ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
            : <><Check size={14} weight="bold" /> {totalDayHours.toFixed(2)} h speichern</>
          }
        </button>
      </form>

      {/* === MONATS-ÜBERSICHT === */}
      <div className="border-t border-gray-100 pt-4">
        <h2 className="text-[12px] font-semibold text-secondary mb-2 px-1">Diesen Monat</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <SpinnerGap size={24} className="animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[13px] text-gray-400">Noch keine Einträge diesen Monat</p>
            <p className="text-[11px] text-gray-300 mt-1">Erfasse oben deinen ersten Arbeitstag</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, items]) => {
                const daySum = items.reduce((s, e) => s + (Number(e.stunden) || 0), 0)
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-1 mb-1.5">
                      <p className="text-[11px] font-semibold text-secondary">{formatLongDate(date)}</p>
                      <p className="text-[11px] text-primary font-bold">{daySum.toFixed(2)} h</p>
                    </div>
                    <div className="space-y-1.5">
                      {items.map(e => (
                        <EntryCard
                          key={e.id}
                          entry={e}
                          zulagen={entryZulagen[e.id] || []}
                          onDelete={() => handleDelete(e.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

function BlockCard({ idx, block, blockCount, projects, onUpdate, onRemove, hours, onProjectCreated, defaultGewerk }) {
  const [showNewProject, setShowNewProject] = useState(false)

  return (
    <div className="card relative">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5">
          <span className="bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {idx + 1}
          </span>
          Block {idx + 1}
          {hours > 0 && (
            <span className="text-primary ml-1">· {hours.toFixed(2)} h</span>
          )}
        </p>
        {blockCount > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="label block mb-0.5">Projekt / Baustelle</label>
          <ProjectCombobox
            projects={projects}
            value={block.projectId}
            onChange={(id) => onUpdate('projectId', id)}
            onCreateNew={() => setShowNewProject(true)}
            placeholder="Projektnummer oder Name suchen (alle Gewerke)..."
          />
        </div>

        <div>
          <label className="label block mb-0.5">Leistungsbeschreibung</label>
          <textarea
            value={block.leistung}
            onChange={e => onUpdate('leistung', e.target.value)}
            className="input-field min-h-[60px]"
            placeholder="Was wurde gemacht? z.B. Steckdosen montiert, Sicherung getauscht..."
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label block mb-0.5">Von</label>
            <input
              type="time"
              step="900"
              value={block.startTime}
              onChange={e => onUpdate('startTime', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Bis</label>
            <input
              type="time"
              step="900"
              value={block.endTime}
              onChange={e => onUpdate('endTime', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label block mb-0.5">Pause min</label>
            <select
              value={block.pauseMinutes}
              onChange={e => onUpdate('pauseMinutes', e.target.value)}
              className="input-field"
            >
              <option value="0">0</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="45">45</option>
              <option value="60">60</option>
              <option value="90">90</option>
            </select>
          </div>
        </div>
      </div>

      {showNewProject && (
        <ProjectDialog
          defaultGewerk={defaultGewerk || 'elektro'}
          onClose={() => setShowNewProject(false)}
          onCreated={(p) => {
            setShowNewProject(false)
            onProjectCreated(p)
            onUpdate('projectId', p.id)
          }}
        />
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
  const locationLabel = entry.location_type === 'werkstatt' ? 'Firma' : 'Baustelle'
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {entry.is_absence ? (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-px rounded font-medium">
                {entry.absence_type}
              </span>
            ) : (
              <>
                {entry.project_records ? (
                  <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded truncate max-w-[180px] font-medium">
                    {entry.project_records.name}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Ohne Projekt</span>
                )}
                <span className="text-[10px] text-gray-400">· {locationLabel}</span>
              </>
            )}
          </div>
          {entry.taetigkeit && <p className="text-[12px] text-secondary truncate">{entry.taetigkeit}</p>}
          {!entry.is_absence && entry.start_time && entry.end_time && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {entry.start_time}–{entry.end_time}
              {entry.pause_minutes > 0 ? ` · ${entry.pause_minutes}min Pause` : ''}
            </p>
          )}
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
          <span className="text-[14px] font-bold text-primary">{Number(entry.stunden).toFixed(2)} h</span>
          {zulagenSum > 0 && <span className="text-[10px] text-emerald-600">+{zulagenSum.toFixed(2)} €</span>}
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 mt-1 transition-colors"
            aria-label="Löschen"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatLongDate(d) {
  const date = new Date(d)
  const today = new Date().toISOString().slice(0, 10)
  if (d === today) return 'Heute · ' + date.toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })
  return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short' })
}
