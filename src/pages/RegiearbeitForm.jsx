import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FloppyDisk, Trash, SpinnerGap, Plus, X, Camera, Image as ImageIcon } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProjects } from '../lib/projectRecords.js'
import {
  loadDisturbance, createDisturbance, updateDisturbance, deleteDisturbance,
  loadDisturbanceMaterials, addDisturbanceMaterial, deleteDisturbanceMaterial,
  loadDisturbancePhotos, uploadDisturbancePhoto, deleteDisturbancePhoto, getDisturbancePhotoUrl,
} from '../lib/disturbances.js'
import PageHeader from '../components/Layout/PageHeader.jsx'
import ProjectCombobox from '../components/ProjectCombobox.jsx'
import ProjectDialog from '../components/ProjectDialog.jsx'

export default function RegiearbeitForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const photoInputRef = useRef(null)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)

  const [form, setForm] = useState({
    datum: new Date().toISOString().slice(0, 10),
    project_id: '',
    kunde_name: '', kunde_email: '', kunde_telefon: '', kunde_adresse: '',
    start_time: '', end_time: '', pause_minutes: '0', stunden: '',
    beschreibung: '', notizen: '',
    is_verrechnet: false, status: 'offen',
  })

  const [materials, setMaterials] = useState([])
  const [matForm, setMatForm] = useState({ material: '', menge: '', einheit: 'Stk' })
  const [photos, setPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    init()
  }, [id])

  async function init() {
    setLoading(true)
    try {
      const projs = await loadProjects()
      setProjects(projs.filter(p => p.status === 'aktiv'))

      if (isEdit) {
        const d = await loadDisturbance(id)
        if (d) {
          setForm({
            datum: d.datum?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            project_id: d.project_id || '',
            kunde_name: d.kunde_name || '', kunde_email: d.kunde_email || '',
            kunde_telefon: d.kunde_telefon || '', kunde_adresse: d.kunde_adresse || '',
            start_time: d.start_time || '', end_time: d.end_time || '',
            pause_minutes: String(d.pause_minutes || 0),
            stunden: d.stunden ? String(d.stunden) : '',
            beschreibung: d.beschreibung || '', notizen: d.notizen || '',
            is_verrechnet: d.is_verrechnet || false, status: d.status || 'offen',
          })
        }
        const [mats, phs] = await Promise.all([
          loadDisturbanceMaterials(id),
          loadDisturbancePhotos(id),
        ])
        setMaterials(mats)
        // Load thumb URLs for photos
        const phWithUrls = await Promise.all(phs.map(async p => ({
          ...p, url: await getDisturbancePhotoUrl(p).catch(() => null),
        })))
        setPhotos(phWithUrls)
      }
    } catch (err) {
      showToast(err.message || 'Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  function calcStunden() {
    if (!form.start_time || !form.end_time) return 0
    const [sh, sm] = form.start_time.split(':').map(Number)
    const [eh, em] = form.end_time.split(':').map(Number)
    return Math.max(0, Math.round((eh * 60 + em - sh * 60 - sm - parseInt(form.pause_minutes || 0)) / 60 * 100) / 100)
  }

  async function handleSave() {
    if (!form.kunde_name) {
      showToast('Bitte Kundenname eingeben', 'error')
      return
    }
    setSaving(true)
    try {
      const stunden = parseFloat(form.stunden) || calcStunden()
      const payload = {
        datum: form.datum,
        project_id: form.project_id || null,
        kunde_name: form.kunde_name, kunde_email: form.kunde_email,
        kunde_telefon: form.kunde_telefon, kunde_adresse: form.kunde_adresse,
        start_time: form.start_time || null, end_time: form.end_time || null,
        pause_minutes: parseInt(form.pause_minutes) || 0,
        stunden,
        beschreibung: form.beschreibung, notizen: form.notizen,
        is_verrechnet: form.is_verrechnet, status: form.status,
      }

      if (isEdit) {
        await updateDisturbance(id, payload)
        showToast('Gespeichert')
      } else {
        const created = await createDisturbance(payload)
        showToast('Regiearbeit erfasst')
        navigate(`/regiearbeiten/${created.id}`, { replace: true })
        return
      }
    } catch (err) {
      showToast(err.message || 'Speichern fehlgeschlagen', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Regiearbeit wirklich löschen?')) return
    try {
      await deleteDisturbance(id)
      showToast('Gelöscht')
      navigate('/regiearbeiten')
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    }
  }

  async function handleAddMaterial(e) {
    e.preventDefault()
    if (!matForm.material.trim() || !id) return
    try {
      const added = await addDisturbanceMaterial(id, matForm.material, matForm.menge, matForm.einheit)
      setMaterials(prev => [...prev, added])
      setMatForm({ material: '', menge: '', einheit: 'Stk' })
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    }
  }

  async function handleDeleteMaterial(mid) {
    try {
      await deleteDisturbanceMaterial(mid)
      setMaterials(prev => prev.filter(m => m.id !== mid))
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !id) return
    setUploadingPhoto(true)
    try {
      for (const file of files) {
        const photo = await uploadDisturbancePhoto(id, file)
        const url = await getDisturbancePhotoUrl(photo)
        setPhotos(prev => [...prev, { ...photo, url }])
      }
      showToast(`${files.length} Foto(s) hinzugefügt`)
    } catch (err) {
      showToast(err.message || 'Upload fehlgeschlagen', 'error')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(photo) {
    if (!confirm('Foto löschen?')) return
    try {
      await deleteDisturbancePhoto(photo)
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><SpinnerGap size={28} className="animate-spin text-primary" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader
        title={isEdit ? 'Regiearbeit' : 'Neue Regiearbeit'}
        backTo="/regiearbeiten"
        action={
          isEdit ? (
            <button onClick={handleDelete} className="text-red-500 px-2 py-1 text-[11px]">
              <Trash size={13} weight="bold" />
            </button>
          ) : null
        }
      />

      <div className="px-4 pt-3 space-y-3">
        {/* Stammdaten */}
        <Section title="Datum & Projekt">
          <div>
            <label className="label block mb-0.5">Datum</label>
            <input type="date" value={form.datum}
              onChange={e => setForm({ ...form, datum: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label block mb-0.5">Projekt (optional)</label>
            <ProjectCombobox
              projects={projects}
              value={form.project_id}
              onChange={(id) => setForm({ ...form, project_id: id })}
              onCreateNew={() => setShowNewProject(true)}
              placeholder="Projekt suchen oder anlegen..."
            />
          </div>
        </Section>

        {/* Kunde */}
        <Section title="Kunde">
          <input value={form.kunde_name}
            onChange={e => setForm({ ...form, kunde_name: e.target.value })}
            className="input-field" placeholder="Kundenname *" required />
          <input value={form.kunde_adresse}
            onChange={e => setForm({ ...form, kunde_adresse: e.target.value })}
            className="input-field" placeholder="Adresse" />
          <div className="grid grid-cols-2 gap-2">
            <input type="email" value={form.kunde_email}
              onChange={e => setForm({ ...form, kunde_email: e.target.value })}
              className="input-field" placeholder="E-Mail" />
            <input value={form.kunde_telefon}
              onChange={e => setForm({ ...form, kunde_telefon: e.target.value })}
              className="input-field" placeholder="Telefon" />
          </div>
        </Section>

        {/* Zeit */}
        <Section title="Arbeitszeit">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label block mb-0.5">Von</label>
              <input type="time" value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label block mb-0.5">Bis</label>
              <input type="time" value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label block mb-0.5">Pause min</label>
              <input type="number" value={form.pause_minutes}
                onChange={e => setForm({ ...form, pause_minutes: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label block mb-0.5">Stunden gesamt</label>
            <input type="number" step="0.25" value={form.stunden}
              onChange={e => setForm({ ...form, stunden: e.target.value })} className="input-field"
              placeholder={`Auto: ${calcStunden().toFixed(2)}h`} />
          </div>
        </Section>

        {/* Beschreibung */}
        <Section title="Beschreibung">
          <textarea value={form.beschreibung}
            onChange={e => setForm({ ...form, beschreibung: e.target.value })}
            className="input-field min-h-[80px]"
            placeholder="Was wurde gemacht? (z.B. Steckdose ausgetauscht, Sicherung getauscht...)" />
          <textarea value={form.notizen}
            onChange={e => setForm({ ...form, notizen: e.target.value })}
            className="input-field min-h-[50px]" placeholder="Interne Notizen (optional)" />
        </Section>

        {/* Status */}
        <Section title="Status">
          <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
            {[
              { v: 'offen', l: 'Offen' },
              { v: 'erledigt', l: 'Erledigt' },
            ].map(s => (
              <button key={s.v} type="button"
                onClick={() => setForm({ ...form, status: s.v })}
                className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
                  ${form.status === s.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}>
                {s.l}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={form.is_verrechnet}
              onChange={e => setForm({ ...form, is_verrechnet: e.target.checked })}
              className="w-4 h-4 accent-primary" />
            <span className="text-[12px] text-secondary">Bereits verrechnet</span>
          </label>
        </Section>

        {/* Material - nur wenn schon gespeichert */}
        {isEdit && (
          <Section title={`Material (${materials.length})`}>
            <form onSubmit={handleAddMaterial} className="grid grid-cols-12 gap-1.5">
              <input value={matForm.material}
                onChange={e => setMatForm({ ...matForm, material: e.target.value })}
                className="input-field col-span-6" placeholder="Material" />
              <input type="number" step="0.01" value={matForm.menge}
                onChange={e => setMatForm({ ...matForm, menge: e.target.value })}
                className="input-field col-span-2" placeholder="Menge" />
              <select value={matForm.einheit}
                onChange={e => setMatForm({ ...matForm, einheit: e.target.value })}
                className="input-field col-span-2">
                <option>Stk</option><option>m</option><option>m²</option>
                <option>Lfm</option><option>kg</option>
              </select>
              <button type="submit" className="btn-primary col-span-2 px-1">
                <Plus size={14} weight="bold" />
              </button>
            </form>
            {materials.length > 0 && (
              <div className="space-y-1 mt-2">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                    <span className="text-[12px] text-secondary flex-1 truncate">{m.material}</span>
                    <span className="text-[11px] text-gray-500">
                      {m.menge ? `${Number(m.menge).toLocaleString('de-AT')} ${m.einheit || ''}` : ''}
                    </span>
                    <button onClick={() => handleDeleteMaterial(m.id)} className="text-gray-300 hover:text-red-500">
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Fotos - nur wenn schon gespeichert */}
        {isEdit && (
          <Section title={`Fotos (${photos.length})`}>
            <input ref={photoInputRef} type="file" multiple accept="image/*"
              onChange={handlePhotoUpload} className="hidden" />
            <button onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto} className="btn-secondary w-full">
              {uploadingPhoto
                ? <SpinnerGap size={13} weight="bold" className="animate-spin" />
                : <><Camera size={13} weight="fill" /> Foto hinzufügen</>
              }
            </button>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {photos.map(p => (
                  <div key={p.id} className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                    {p.url ? (
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={20} className="text-gray-300" />
                      </div>
                    )}
                    <button onClick={() => handleDeletePhoto(p)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center">
                      <Trash size={11} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving
            ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
            : <><FloppyDisk size={14} weight="fill" /> {isEdit ? 'Änderungen speichern' : 'Erfassen'}</>
          }
        </button>

        {!isEdit && (
          <p className="text-[11px] text-gray-400 text-center">
            Material und Fotos kannst du nach dem Speichern hinzufügen.
          </p>
        )}
      </div>

      {showNewProject && (
        <ProjectDialog
          defaultGewerk="elektro"
          onClose={() => setShowNewProject(false)}
          onCreated={(p) => {
            setProjects(prev => [p, ...prev])
            setForm(f => ({ ...f, project_id: p.id }))
            setShowNewProject(false)
          }}
        />
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card">
      <h3 className="text-[12px] font-semibold text-secondary mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
