import { useState, useEffect } from 'react'
import { FileText, FilePdf, Image as ImageIcon, Download, SpinnerGap, FolderOpen } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadMyDocuments, getDocumentUrl, DOC_CATEGORIES } from '../lib/employeeDocuments.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function MeineDokumente() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('alle')

  useEffect(() => {
    if (!user) return
    loadMyDocuments(user.id)
      .then(setDocs)
      .catch(() => showToast('Dokumente konnten nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  }, [user])

  async function handleOpen(doc) {
    try {
      const url = await getDocumentUrl(doc)
      window.open(url, '_blank')
    } catch {
      showToast('Datei konnte nicht geöffnet werden', 'error')
    }
  }

  const filtered = filter === 'alle' ? docs : docs.filter(d => d.category === filter)

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader title="Meine Dokumente" backTo="/" />

      <div className="px-4 pt-3">
        <p className="text-[12px] text-gray-400 mb-3">
          Hier findest du deine Lohnzettel, Krankmeldungen und weitere persönliche Dokumente.
        </p>

        <div className="overflow-x-auto -mx-4 px-4 mb-3">
          <div className="flex gap-px bg-gray-100 rounded-md p-0.5 w-max">
            <button
              onClick={() => setFilter('alle')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-[5px] whitespace-nowrap
                ${filter === 'alle' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
            >
              Alle ({docs.length})
            </button>
            {DOC_CATEGORIES.map(c => {
              const count = docs.filter(d => d.category === c.v).length
              return (
                <button key={c.v}
                  onClick={() => setFilter(c.v)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-[5px] whitespace-nowrap
                    ${filter === c.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
                >
                  {c.l} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <SpinnerGap size={24} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[13px] text-gray-400">Noch keine Dokumente vorhanden</p>
            <p className="text-[11px] text-gray-300 mt-1">
              Dokumente werden vom Administrator hochgeladen
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(d => {
              const ext = (d.file_name || '').split('.').pop().toLowerCase()
              const Icon = ext === 'pdf' ? FilePdf : ['jpg', 'jpeg', 'png'].includes(ext) ? ImageIcon : FileText
              return (
                <button key={d.id}
                  onClick={() => handleOpen(d)}
                  className="w-full bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center gap-2 active:bg-gray-50">
                  <Icon size={20} weight="regular" className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded">
                        {DOC_CATEGORIES.find(c => c.v === d.category)?.l || d.category}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(d.uploaded_at)}</span>
                    </div>
                    <p className="text-[12px] font-medium text-secondary truncate">{d.file_name}</p>
                  </div>
                  <Download size={14} className="text-gray-300" />
                </button>
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
