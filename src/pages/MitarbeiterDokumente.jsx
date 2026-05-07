import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { UploadSimple, Trash, Download, SpinnerGap, FileText, FilePdf, Image as ImageIcon, FolderOpen, Plus } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import {
  loadEmployeeDocuments, uploadEmployeeDocument, getDocumentUrl, deleteEmployeeDocument, DOC_CATEGORIES,
} from '../lib/employeeDocuments.js'
import { supabase } from '../lib/supabase.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function MitarbeiterDokumente() {
  const { employeeId } = useParams()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const fileRef = useRef(null)

  const [employee, setEmployee] = useState(null)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('lohnzettel')

  useEffect(() => {
    if (!employeeId) return
    refresh()
  }, [employeeId])

  async function refresh() {
    setLoading(true)
    try {
      const [emp, ds] = await Promise.all([
        supabase.from('employees').select('*').eq('id', employeeId).maybeSingle().then(r => r.data),
        loadEmployeeDocuments(employeeId),
      ])
      setEmployee(emp)
      setDocs(ds)
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        await uploadEmployeeDocument({
          userId: employee?.user_id,
          employeeId: employee?.id,
          category,
          file,
        })
      }
      await refresh()
      showToast(`${files.length} Datei(en) hochgeladen`)
    } catch (err) {
      showToast(err.message || 'Upload fehlgeschlagen', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleOpen(doc) {
    try {
      const url = await getDocumentUrl(doc)
      window.open(url, '_blank')
    } catch {
      showToast('Datei konnte nicht geöffnet werden', 'error')
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`"${doc.file_name}" löschen?`)) return
    try {
      await deleteEmployeeDocument(doc)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  if (!isAdmin) return <p>Kein Zugriff</p>

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader
        title={employee ? `${employee.vorname} ${employee.nachname}` : 'Mitarbeiter'}
        subtitle="Dokumente verwalten"
        backTo="/mitarbeiter"
      />

      <div className="px-4 pt-3">
        <div className="card mb-3">
          <h3 className="text-[12px] font-semibold text-secondary mb-2">Dokument hochladen</h3>
          <select value={category} onChange={e => setCategory(e.target.value)} className="input-field mb-2">
            {DOC_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <input ref={fileRef} type="file" multiple onChange={handleUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary w-full">
            {uploading
              ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
              : <><UploadSimple size={14} weight="bold" /> Datei auswählen</>
            }
          </button>
        </div>

        <h2 className="text-[12px] font-semibold text-secondary mb-2 px-1">
          {docs.length} {docs.length === 1 ? 'Dokument' : 'Dokumente'}
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <SpinnerGap size={24} className="animate-spin text-primary" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[12px] text-gray-400">Noch keine Dokumente</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map(d => {
              const ext = (d.file_name || '').split('.').pop().toLowerCase()
              const Icon = ext === 'pdf' ? FilePdf : ['jpg', 'jpeg', 'png'].includes(ext) ? ImageIcon : FileText
              return (
                <div key={d.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2">
                  <Icon size={20} weight="regular" className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded">
                        {DOC_CATEGORIES.find(c => c.v === d.category)?.l || d.category}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(d.uploaded_at)}</span>
                    </div>
                    <p className="text-[12px] font-medium text-secondary truncate">{d.file_name}</p>
                  </div>
                  <button onClick={() => handleOpen(d)} className="touch-btn text-gray-400">
                    <Download size={14} />
                  </button>
                  <button onClick={() => handleDelete(d)} className="touch-btn text-gray-300 hover:text-red-500">
                    <Trash size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
