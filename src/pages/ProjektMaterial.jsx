import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash, SpinnerGap, Package } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProject } from '../lib/projectRecords.js'
import { listProjectMaterials, addProjectMaterial, deleteMaterial } from '../lib/projectFiles.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function ProjektMaterial() {
  const { id } = useParams()
  const { showToast } = useToast()
  const [project, setProject] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ material: '', menge: '', einheit: 'Stk', notizen: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    refresh()
  }, [id])

  async function refresh() {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([loadProject(id), listProjectMaterials(id)])
      setProject(p)
      setItems(m)
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.material.trim()) return
    setSaving(true)
    try {
      await addProjectMaterial({ projectId: id, ...form })
      setForm({ material: '', menge: '', einheit: 'Stk', notizen: '' })
      await refresh()
      showToast('Material erfasst')
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(matId) {
    if (!confirm('Eintrag löschen?')) return
    try {
      await deleteMaterial(matId)
      setItems(prev => prev.filter(x => x.id !== matId))
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader
        title="Material"
        subtitle={project?.name || ''}
        backTo={`/projekte/${id}`}
      />

      <div className="px-4 pt-3 space-y-3">
        <form onSubmit={handleSubmit} className="card space-y-2">
          <div>
            <label className="label block mb-0.5">Material *</label>
            <input
              required
              value={form.material}
              onChange={e => setForm({ ...form, material: e.target.value })}
              className="input-field"
              placeholder="z.B. Kabel NYM-J 3x1,5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Menge</label>
              <input
                type="number"
                step="0.01"
                value={form.menge}
                onChange={e => setForm({ ...form, menge: e.target.value })}
                className="input-field"
                placeholder="z.B. 50"
              />
            </div>
            <div>
              <label className="label block mb-0.5">Einheit</label>
              <select
                value={form.einheit}
                onChange={e => setForm({ ...form, einheit: e.target.value })}
                className="input-field"
              >
                <option>Stk</option>
                <option>m</option>
                <option>m²</option>
                <option>Lfm</option>
                <option>kg</option>
                <option>Set</option>
                <option>Pkg</option>
              </select>
            </div>
          </div>
          <input
            value={form.notizen}
            onChange={e => setForm({ ...form, notizen: e.target.value })}
            className="input-field"
            placeholder="Notizen (optional)"
          />
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : <><Plus size={14} weight="bold" /> Erfassen</>}
          </button>
        </form>

        <div>
          <h2 className="text-[12px] font-semibold text-secondary mb-2 px-1">
            {items.length} {items.length === 1 ? 'Material-Eintrag' : 'Material-Einträge'}
          </h2>
          {loading ? (
            <div className="flex justify-center py-6">
              <SpinnerGap size={20} className="animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Package size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-[12px] text-gray-400">Noch keine Materialien erfasst</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map(m => (
                <div key={m.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-secondary truncate">{m.material}</p>
                    {m.notizen && <p className="text-[10px] text-gray-400 truncate">{m.notizen}</p>}
                  </div>
                  <span className="text-[12px] font-bold text-primary whitespace-nowrap">
                    {m.menge ? `${Number(m.menge).toLocaleString('de-AT')} ${m.einheit || ''}` : ''}
                  </span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="touch-btn text-gray-300 hover:text-red-500"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
