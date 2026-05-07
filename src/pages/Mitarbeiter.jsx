import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, SpinnerGap, UserCircle, Trash, PencilSimple, FolderOpen } from '@phosphor-icons/react'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadEmployees, createEmployee, updateEmployee, deleteEmployee } from '../lib/employees.js'

export default function Mitarbeiter() {
  const { showToast } = useToast()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const data = await loadEmployees()
      setEmployees(data)
    } catch (err) {
      showToast('Mitarbeiter konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Mitarbeiter wirklich löschen?')) return
    try {
      await deleteEmployee(id)
      setEmployees(prev => prev.filter(e => e.id !== id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Mitarbeiter</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary px-3">
          <Plus size={14} weight="bold" />
          Neu
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerGap size={28} weight="bold" className="text-primary animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-400">
          <UserCircle size={36} className="mx-auto mb-2 text-gray-200" />
          Noch keine Mitarbeiter erfasst
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map(e => (
            <div key={e.id} className="bg-white rounded-lg border border-gray-100 p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  {(e.vorname || '?').charAt(0)}{(e.nachname || '').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-secondary truncate">
                    {e.vorname} {e.nachname}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {e.position || '–'}{e.email ? ` · ${e.email}` : ''}
                  </p>
                  {e.stundenlohn && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Stundenlohn: <strong>{Number(e.stundenlohn).toFixed(2)} €</strong>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/mitarbeiter/${e.id}/dokumente`} className="touch-btn text-gray-400" title="Dokumente">
                    <FolderOpen size={14} />
                  </Link>
                  <button onClick={() => setEditing(e)} className="touch-btn text-gray-400">
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} className="touch-btn text-gray-300 hover:text-red-500">
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <EmployeeDialog
          employee={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}

function EmployeeDialog({ employee, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    vorname: employee?.vorname || '',
    nachname: employee?.nachname || '',
    email: employee?.email || '',
    telefon: employee?.telefon || '',
    position: employee?.position || '',
    stundenlohn: employee?.stundenlohn || '',
    eintritt_datum: employee?.eintritt_datum || '',
    sv_nummer: employee?.sv_nummer || '',
    iban: employee?.iban || '',
    adresse: employee?.adresse || '',
    plz: employee?.plz || '',
    ort: employee?.ort || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.vorname || !form.nachname) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        stundenlohn: form.stundenlohn ? parseFloat(form.stundenlohn) : null,
        eintritt_datum: form.eintritt_datum || null,
      }
      if (employee) {
        await updateEmployee(employee.id, payload)
      } else {
        await createEmployee(payload)
      }
      showToast(employee ? 'Aktualisiert' : 'Mitarbeiter angelegt')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">
            {employee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
          </h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Vorname *" value={form.vorname}
              onChange={e => setForm({ ...form, vorname: e.target.value })} className="input-field" />
            <input required placeholder="Nachname *" value={form.nachname}
              onChange={e => setForm({ ...form, nachname: e.target.value })} className="input-field" />
          </div>
          <input type="email" placeholder="E-Mail" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
          <input placeholder="Telefon" value={form.telefon}
            onChange={e => setForm({ ...form, telefon: e.target.value })} className="input-field" />
          <input placeholder="Position (z.B. Elektriker)" value={form.position}
            onChange={e => setForm({ ...form, position: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" placeholder="Stundenlohn €" value={form.stundenlohn}
              onChange={e => setForm({ ...form, stundenlohn: e.target.value })} className="input-field" />
            <input type="date" placeholder="Eintritt" value={form.eintritt_datum}
              onChange={e => setForm({ ...form, eintritt_datum: e.target.value })} className="input-field" />
          </div>
          <input placeholder="SV-Nummer" value={form.sv_nummer}
            onChange={e => setForm({ ...form, sv_nummer: e.target.value })} className="input-field" />
          <input placeholder="IBAN" value={form.iban}
            onChange={e => setForm({ ...form, iban: e.target.value })} className="input-field" />
          <input placeholder="Adresse" value={form.adresse}
            onChange={e => setForm({ ...form, adresse: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="PLZ" value={form.plz}
              onChange={e => setForm({ ...form, plz: e.target.value })} className="input-field" />
            <input placeholder="Ort" value={form.ort}
              onChange={e => setForm({ ...form, ort: e.target.value })} className="input-field" />
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full mt-3">
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
