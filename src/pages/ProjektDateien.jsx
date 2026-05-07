import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash, Download, SpinnerGap, FileText, Image as ImageIcon, FilePdf, ArrowLeft, UploadSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadProject } from '../lib/projectRecords.js'
import { listProjectFiles, uploadProjectFile, deleteProjectFile, getProjectFileUrl, CATEGORIES } from '../lib/projectFiles.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function ProjektDateien() {
  const { id, category } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)

  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openUrl, setOpenUrl] = useState(null)

  const cat = CATEGORIES.find(c => c.v === category)

  useEffect(() => {
    if (!id) return
    if (category === 'chef' && !isAdmin) {
      navigate(`/projekte/${id}`)
      return
    }
    refresh()
  }, [id, category, isAdmin])

  async function refresh() {
    setLoading(true)
    try {
      const [p, fs] = await Promise.all([
        loadProject(id),
        listProjectFiles(id, category),
      ])
      setProject(p)
      setFiles(fs)
    } catch (err) {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const fileList = Array.from(e.target.files || [])
    if (fileList.length === 0) return
    setUploading(true)
    try {
      for (const file of fileList) {
        await uploadProjectFile(id, category, file)
      }
      await refresh()
      showToast(`${fileList.length} Datei(en) hochgeladen`)
    } catch (err) {
      showToast(err.message || 'Upload fehlgeschlagen', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(file) {
    if (!confirm(`"${file.file_name}" löschen?`)) return
    try {
      await deleteProjectFile(file)
      setFiles(prev => prev.filter(f => f.id !== file.id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  async function handleOpen(file) {
    try {
      const url = await getProjectFileUrl(file)
      setOpenUrl({ url, file })
    } catch {
      showToast('Datei konnte nicht geladen werden', 'error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <PageHeader
        title={cat?.l || 'Dateien'}
        subtitle={project?.name || ''}
        backTo={`/projekte/${id}`}
        action={
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary px-3 text-[12px]"
          >
            {uploading
              ? <SpinnerGap size={13} weight="bold" className="animate-spin" />
              : <><UploadSimple size={13} weight="bold" /> Upload</>
            }
          </button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
        accept={category === 'fotos' ? 'image/*' : '*'}
      />

      <div className="px-4 pt-3">
        {cat?.desc && (
          <p className="text-[11px] text-gray-400 mb-3">{cat.desc}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <SpinnerGap size={24} className="animate-spin text-primary" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[12px] text-gray-400">Noch keine Dateien</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary mt-3 inline-flex"
            >
              <Plus size={14} weight="bold" />
              Erste Datei hochladen
            </button>
          </div>
        ) : category === 'fotos' ? (
          <PhotoGrid files={files} onOpen={handleOpen} onDelete={handleDelete} />
        ) : (
          <FileList files={files} onOpen={handleOpen} onDelete={handleDelete} />
        )}
      </div>

      {openUrl && (
        <FileViewer
          url={openUrl.url}
          file={openUrl.file}
          onClose={() => setOpenUrl(null)}
        />
      )}
    </div>
  )
}

function PhotoGrid({ files, onOpen, onDelete }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {files.map(f => (
        <PhotoCard key={f.id} file={f} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  )
}

function PhotoCard({ file, onOpen, onDelete }) {
  const [thumb, setThumb] = useState(null)
  useEffect(() => {
    getProjectFileUrl(file).then(setThumb).catch(() => {})
  }, [file.id])

  return (
    <div className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
      {thumb ? (
        <img
          src={thumb}
          alt={file.file_name}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => onOpen(file)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <SpinnerGap size={16} className="animate-spin text-gray-300" />
        </div>
      )}
      <button
        onClick={() => onDelete(file)}
        className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
      >
        <Trash size={11} weight="bold" />
      </button>
    </div>
  )
}

function FileList({ files, onOpen, onDelete }) {
  return (
    <div className="space-y-1.5">
      {files.map(f => {
        const ext = (f.file_name || '').split('.').pop().toLowerCase()
        const Icon = ['pdf'].includes(ext) ? FilePdf : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ImageIcon : FileText
        return (
          <div
            key={f.id}
            className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2"
          >
            <Icon size={20} weight="regular" className="text-gray-400 flex-shrink-0" />
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onOpen(f)}
            >
              <p className="text-[12px] font-medium text-secondary truncate">{f.file_name}</p>
              <p className="text-[10px] text-gray-400">
                {formatSize(f.file_size)} · {formatDate(f.created_at)}
              </p>
            </div>
            <button
              onClick={() => onOpen(f)}
              className="touch-btn text-gray-400"
              title="Öffnen"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => onDelete(f)}
              className="touch-btn text-gray-300 hover:text-red-500"
            >
              <Trash size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FileViewer({ url, file, onClose }) {
  const ext = (file.file_name || '').split('.').pop().toLowerCase()
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  const isPdf = ext === 'pdf'

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <p className="text-[12px] truncate flex-1">{file.file_name}</p>
        <a
          href={url}
          download={file.file_name}
          className="text-white/80 px-2 py-1 rounded text-[11px] flex items-center gap-1"
        >
          <Download size={13} />
          Download
        </a>
        <button onClick={onClose} className="text-white/80 px-2 py-1 ml-1 text-[11px]">
          Schließen
        </button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isImg ? (
          <img src={url} alt={file.file_name} className="max-w-full max-h-full object-contain" />
        ) : isPdf ? (
          <iframe src={url} className="w-full h-full bg-white rounded" title={file.file_name} />
        ) : (
          <div className="text-white text-center">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-[12px] opacity-70">Vorschau nicht verfügbar</p>
            <a href={url} download className="btn-primary inline-flex mt-3">
              <Download size={14} weight="bold" />
              Herunterladen
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
