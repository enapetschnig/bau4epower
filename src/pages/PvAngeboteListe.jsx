import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, MagnifyingGlass, FileText, Trash, FilePdf, SpinnerGap, Wrench } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadPvOffers, deletePvOffer, loadPvOffer } from '../lib/pvOffers.js'
import { generatePvAngebotPdf } from '../lib/pvPdfGenerator.js'

export default function PvAngeboteListe() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pdfLoading, setPdfLoading] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const data = await loadPvOffers()
      setOffers(data)
    } catch (err) {
      showToast('Angebote konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm('Angebot wirklich löschen?')) return
    try {
      await deletePvOffer(id)
      setOffers(prev => prev.filter(o => o.id !== id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  async function handleGeneratePdf(id, e) {
    e.stopPropagation()
    e.preventDefault()
    setPdfLoading(id)
    try {
      const offer = await loadPvOffer(id)
      const blob = await generatePvAngebotPdf(offer)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Angebot_${offer.beleg_nr}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('PDF-Erstellung fehlgeschlagen', 'error')
    } finally {
      setPdfLoading(null)
    }
  }

  const filtered = offers.filter(o => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (o.nachname || '').toLowerCase().includes(s) ||
      (o.firma || '').toLowerCase().includes(s) ||
      (o.beleg_nr || '').toLowerCase().includes(s) ||
      (o.ort || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">PV-Angebote</h1>
        <div className="flex gap-1">
          {isAdmin && (
            <Link to="/angebote/material" className="btn-secondary px-3 text-[12px]">
              <Wrench size={13} weight="bold" />
              Material
            </Link>
          )}
          <Link to="/angebote/neu" className="btn-primary px-3">
            <Plus size={14} weight="bold" />
            Neu
          </Link>
        </div>
      </div>

      <div className="relative mb-3">
        <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="Kunde, Beleg-Nr. oder Ort..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerGap size={28} weight="bold" className="text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-400">
          <FileText size={36} className="mx-auto mb-2 text-gray-200" />
          {search ? 'Keine Angebote gefunden' : 'Noch keine Angebote erstellt'}
          <div className="mt-3">
            <Link to="/angebote/neu" className="btn-primary inline-flex">
              <Plus size={14} weight="bold" />
              Erstes Angebot erstellen
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const customerName = o.firma || `${o.vorname || ''} ${o.nachname || ''}`.trim() || '–'
            return (
              <Link
                key={o.id}
                to={`/angebote/neu/${o.id}`}
                className="block bg-white rounded-lg border border-gray-100 p-3 active:bg-gray-50 transition-colors"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded font-mono">
                        {o.beleg_nr}
                      </span>
                      <span className={`text-[10px] px-1.5 py-px rounded
                        ${o.status === 'angenommen' ? 'bg-green-50 text-green-600' :
                          o.status === 'gesendet' ? 'bg-blue-50 text-blue-600' :
                          o.status === 'abgelehnt' ? 'bg-rose-50 text-rose-600' :
                          'bg-gray-100 text-gray-500'}`}>
                        {o.status}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-semibold text-secondary truncate">
                      {o.anrede} {customerName}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {o.plz ? `${o.plz} ` : ''}{o.ort || ''}
                      {o.anlage_kwp ? ` · ${Number(o.anlage_kwp).toLocaleString('de-AT')}kWp` : ''}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDate(o.datum)} · <strong className="text-primary">{Number(o.brutto || 0).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => handleGeneratePdf(o.id, e)}
                      disabled={pdfLoading === o.id}
                      className="touch-btn text-gray-400 hover:text-primary"
                      title="PDF erstellen"
                    >
                      {pdfLoading === o.id
                        ? <SpinnerGap size={14} className="animate-spin" />
                        : <FilePdf size={14} />}
                    </button>
                    <button
                      onClick={e => handleDelete(o.id, e)}
                      className="touch-btn text-gray-300 hover:text-red-500"
                      title="Löschen"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDate(d) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
