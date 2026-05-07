import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Image as ImageIcon, FolderOpen, Lock, Package, MapPin, Briefcase, Trash, PencilSimple, SpinnerGap, Clock } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProject, deleteProject, updateProject } from '../lib/projectRecords.js'
import { listProjectFiles, listProjectMaterials } from '../lib/projectFiles.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

const CATS = [
  { v: 'plaene', l: 'Pläne', desc: 'Bau- & Schaltpläne', Icon: FileText, color: 'from-blue-500 to-blue-600' },
  { v: 'berichte', l: 'Berichte', desc: 'Bautagesberichte', Icon: FolderOpen, color: 'from-amber-500 to-amber-600' },
  { v: 'fotos', l: 'Fotos', desc: 'Baustellen-Fotos', Icon: ImageIcon, color: 'from-emerald-500 to-emerald-600' },
  { v: 'chef', l: 'Chefordner', desc: 'Nur für Admins', Icon: Lock, color: 'from-rose-500 to-rose-600', adminOnly: true },
]

export default function ProjektDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()

  const [project, setProject] = useState(null)
  const [counts, setCounts] = useState({})
  const [matCount, setMatCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      loadProject(id),
      listProjectFiles(id),
      listProjectMaterials(id),
    ])
      .then(([p, files, mats]) => {
        setProject(p)
        const c = {}
        for (const f of files) c[f.category] = (c[f.category] || 0) + 1
        setCounts(c)
        setMatCount(mats.length)
      })
      .catch(() => showToast('Projekt nicht gefunden', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleClose() {
    if (!confirm(`Projekt "${project.name}" als ${project.status === 'aktiv' ? 'inaktiv' : 'aktiv'} markieren?`)) return
    try {
      await updateProject(id, { status: project.status === 'aktiv' ? 'inaktiv' : 'aktiv' })
      setProject({ ...project, status: project.status === 'aktiv' ? 'inaktiv' : 'aktiv' })
      showToast('Status geändert')
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    }
  }

  async function handleDelete() {
    if (!confirm(`Projekt "${project.name}" wirklich löschen? Alle Daten gehen verloren!`)) return
    try {
      await deleteProject(id)
      showToast('Projekt gelöscht')
      navigate('/projekte')
    } catch (err) {
      showToast(err.message || 'Löschen fehlgeschlagen', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <SpinnerGap size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-[13px] text-gray-400">Projekt nicht gefunden</p>
        <Link to="/projekte" className="btn-primary inline-flex mt-4">
          <ArrowLeft size={14} weight="bold" />
          Zurück zur Liste
        </Link>
      </div>
    )
  }

  const visibleCats = CATS.filter(c => !c.adminOnly || isAdmin)

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <PageHeader
        title={project.name}
        subtitle={project.adresse ? `${project.plz ? project.plz + ' ' : ''}${project.adresse}` : '–'}
        backTo="/projekte"
      />

      <div className="px-4 pt-3">
        {/* Project Info Card */}
        <div className="card mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
                <Briefcase size={18} weight="fill" className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-secondary truncate">{project.name}</p>
                {project.adresse && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                    <MapPin size={11} />
                    {project.plz ? `${project.plz} ` : ''}{project.adresse}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
              ${project.status === 'aktiv' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {project.status}
            </span>
          </div>
          {project.beschreibung && (
            <p className="text-[12px] text-gray-500 mt-2">{project.beschreibung}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link
            to={`/projekte/${id}/material`}
            className="bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-md flex items-center justify-center">
                <Package size={16} weight="fill" className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-secondary">Material</p>
                <p className="text-[10px] text-gray-400">{matCount} {matCount === 1 ? 'Eintrag' : 'Einträge'}</p>
              </div>
            </div>
          </Link>
          <Link
            to={`/zeiterfassung?projekt=${id}`}
            className="bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <Clock size={16} weight="fill" className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-secondary">Zeit erfassen</p>
                <p className="text-[10px] text-gray-400">Stunden auf Projekt</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Document Categories */}
        <h2 className="text-[12px] font-semibold text-secondary mb-2 px-1">Dokumente</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {visibleCats.map(c => (
            <Link
              key={c.v}
              to={`/projekte/${id}/dateien/${c.v}`}
              className="bg-white rounded-xl border border-gray-100 p-3.5 active:scale-[0.97] transition-transform"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br ${c.color}`}>
                <c.Icon size={18} weight="fill" className="text-white" />
              </div>
              <p className="text-[13px] font-semibold text-secondary leading-tight">{c.l}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.desc}</p>
              <p className="text-[10px] text-primary font-medium mt-1.5">
                {counts[c.v] || 0} {(counts[c.v] || 0) === 1 ? 'Datei' : 'Dateien'}
              </p>
            </Link>
          ))}
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button onClick={handleClose} className="btn-secondary">
              <PencilSimple size={13} weight="bold" />
              {project.status === 'aktiv' ? 'Schließen' : 'Aktivieren'}
            </button>
            <button onClick={handleDelete} className="btn-secondary text-red-500 border-red-100">
              <Trash size={13} weight="bold" />
              Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
