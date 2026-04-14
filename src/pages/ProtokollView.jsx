import { useState, useEffect } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom'
import { SpinnerGap, Printer, ArrowLeft, Trash, CheckCircle, PaperPlaneTilt, Envelope, DownloadSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase, getEdgeFunctionHeaders } from '../lib/supabase.js'
import { loadProtokoll, updateProtokollStatus, deleteProtokoll, updateProtokollData, loadProtokollMedia } from '../lib/protokolle.js'
import { generateProtokollPdf } from '../lib/pdfGenerator.js'
import PdfEmailSender from '../components/PdfEmailSender.jsx'
import { loadBauleiter } from '../lib/offers.js'
import { generateMagicLink } from '../lib/magicLink.js'
import { buildProtokollHtml } from '../lib/emailHtml.js'
import { ProtokollEditor } from './Protokoll.jsx'

const isDev = import.meta.env.DEV
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const STATUS_LABEL = { entwurf: 'Entwurf', in_bearbeitung: 'In Bearbeitung', abgeschlossen: 'Abgeschlossen' }
const STATUS_COLOR = {
  entwurf: 'bg-gray-100 text-gray-500',
  in_bearbeitung: 'bg-blue-100 text-blue-600',
  abgeschlossen: 'bg-green-100 text-green-600',
}

const FALLBACK_BAULEITER = [
  { id: 'celik', name: 'Ümit Celik', email: 'info@napetschnig.at', isFallback: true },
  { id: 'lucic', name: 'Dijan Lucic', email: 'info@napetschnig.at', isFallback: true },
]
const LUKASZ_ENTRY = { id: 'lukasz', name: 'Christoph Napetschnig', email: 'napetschnig.chris@gmail.com', isFallback: true }

export default function ProtokollView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const [protokollRecord, setProtokollRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editedProtokoll, setEditedProtokoll] = useState(null)
  const [savingData, setSavingData] = useState(false)

  // Media
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(null)

  // Email sending
  const [bauleiterList, setBauleiterList] = useState([])
  const [selectedBauleiter, setSelectedBauleiter] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentName, setSentName] = useState('')

  useEffect(() => {
    loadBauleiter()
      .then(list => {
        const base = list.length > 0 ? list : FALLBACK_BAULEITER
        const merged = [...base, LUKASZ_ENTRY]
        const seen = new Set()
        setBauleiterList(merged.filter(b => {
          if (seen.has(b.email)) return false
          seen.add(b.email)
          return true
        }))
      })
      .catch(() => setBauleiterList([...FALLBACK_BAULEITER, LUKASZ_ENTRY]))
  }, [])

  useEffect(() => {
    if (!id) return
    loadProtokoll(id)
      .then(data => {
        setProtokollRecord(data)
        setEditedProtokoll(data?.protokoll_data || null)
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    setMediaLoading(true)
    loadProtokollMedia(id)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setMediaLoading(false))
  }, [id])

  async function handleDownloadAll() {
    setDownloadProgress({ current: 0, total: media.length })
    for (let i = 0; i < media.length; i++) {
      const item = media[i]
      setDownloadProgress({ current: i + 1, total: media.length })
      if (!item.signed_url) continue
      try {
        const res = await fetch(item.signed_url)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = item.file_name || `media_${i + 1}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      } catch {
        isDev && console.warn('Download fehlgeschlagen:', item.file_name)
      }
      if (i < media.length - 1) await new Promise(r => setTimeout(r, 400))
    }
    setDownloadProgress(null)
  }

  async function handleStatusUpdate(status) {
    setUpdatingStatus(true)
    try {
      await updateProtokollStatus(id, status)
      setProtokollRecord(prev => ({ ...prev, status }))
      showToast('Status aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteProtokoll(id)
      showToast('Protokoll gelöscht')
      navigate('/besprechung?tab=liste', { replace: true })
    } catch (err) {
      showToast(err.message, 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleSaveData() {
    if (!editedProtokoll) return
    setSavingData(true)
    try {
      await updateProtokollData(id, editedProtokoll)
      setProtokollRecord(prev => ({ ...prev, protokoll_data: editedProtokoll }))
      showToast('Protokoll aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSavingData(false)
    }
  }

  function handleNachtragsangebot() {
    isDev && console.log('[Nachtrag] protokollRecord:', protokollRecord)
    isDev && console.log('[Nachtrag] editedProtokoll:', editedProtokoll)

    const protokoll = editedProtokoll || protokollRecord?.protokoll_data
    if (!protokoll) return
    const zusatz = (protokoll.punkte || []).filter(p => p.ist_zusatzleistung)
    isDev && console.log('[Nachtrag] Zusatzleistungen:', zusatz)

    if (zusatz.length === 0) {
      showToast('Keine Zusatzleistungen im Protokoll gefunden', 'error')
      return
    }

    const lines = zusatz.map(p => {
      let line = `• ${p.thema} - ${p.beschreibung}`
      if (p.massnahme) line += `. Maßnahme: ${p.massnahme}`
      return line
    }).join('\n')

    const inputText = `Projekt: ${protokollRecord.hero_projektnummer || '–'}. Adresse: ${protokollRecord.adresse || '–'}. Betrifft: Nachtrag ${protokollRecord.betrifft || '–'}.
${lines}`

    isDev && console.log('[Nachtrag] inputText:', inputText)

    const nachtragPayload = {
      projektnummer: protokollRecord.hero_projektnummer || '',
      adresse: protokollRecord.adresse || '',
      inputText,
    }
    isDev && console.log('[Nachtrag] Payload:', nachtragPayload)
    try {
      sessionStorage.setItem('napetschnig_nachtrag', JSON.stringify(nachtragPayload))
      isDev && console.log('[Nachtrag] sessionStorage gesetzt:', sessionStorage.getItem('napetschnig_nachtrag'))
    } catch (err) {
      console.error('[Nachtrag] sessionStorage Fehler:', err)
    }

    navigate('/kalkulation?modus=2')
  }

  async function handleSendBauleiter() {
    if (!id) return
    const bl = bauleiterList.find(b => b.id === selectedBauleiter) || {
      email: profile?.email || user?.email || '',
      name: profile?.name || user?.email || 'Unbekannt',
      isFallback: true,
    }
    setSending(true)
    try {
      const protokollLink = `${window.location.origin}/protokoll/${id}`
      let linkForEmail = protokollLink
      try {
        linkForEmail = await generateMagicLink(bl.email, protokollLink)
      } catch {
        linkForEmail = protokollLink
      }
      const protokollData = editedProtokoll || protokollRecord?.protokoll_data || {}
      const htmlBody = buildProtokollHtml({
        betrifft: protokollRecord?.betrifft,
        adresse: protokollRecord?.adresse,
        projektnummer: protokollRecord?.hero_projektnummer,
        protokollData,
        protokollLink: linkForEmail,
        erstelltVon: profile?.name || user?.email || '–',
      })
      const payload = {
        empfaenger: bl.email,
        betreff: `Besprechungsprotokoll: ${protokollRecord?.betrifft || 'Protokoll'}`,
        angebotLink: linkForEmail,
        projektNummer: protokollRecord?.hero_projektnummer || '–',
        adresse: protokollRecord?.adresse || '–',
        betrifft: protokollRecord?.betrifft || '–',
        gesamtsummeNetto: '',
        gesamtsummeBrutto: '',
        absenderName: profile?.name || user?.email || '–',
        absenderEmail: profile?.email || user?.email || '',
        htmlBody,
      }
      isDev && console.log('[Protokoll Mail] Payload:', { ...payload, htmlBody: htmlBody?.slice(0, 100) + '...' })
      const headers = await getEdgeFunctionHeaders()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/webhook-proxy`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      isDev && console.log('[Protokoll Mail] Response:', res.status, res.statusText)
      if (!res.ok) throw new Error(`Webhook Fehler: ${res.status}`)
      const name = bl.name || bl.email
      setSentName(name)
      setSent(true)
      showToast(`E-Mail wurde an ${name} gesendet!`)
    } catch (err) {
      console.error('[Protokoll Mail] Fehler:', err.message, err)
      showToast('E-Mail konnte nicht gesendet werden.', 'error')
    } finally {
      setSending(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
        <SpinnerGap size={40} weight="bold" className="text-primary animate-spin" />
      </div>
    )
  }

  if (fetchError || !protokollRecord) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="card text-center py-8 space-y-3">
          <p className="text-red-500 font-medium">Protokoll konnte nicht geladen werden</p>
          <p className="text-sm text-gray-400">{fetchError}</p>
          <Link to="/besprechung?tab=liste" className="btn-secondary inline-block mt-2">Zur Übersicht</Link>
        </div>
      </div>
    )
  }

  const protokoll = editedProtokoll || protokollRecord.protokoll_data || {}
  const zusatzCount = (protokoll.punkte || []).filter(p => p.ist_zusatzleistung).length
  const datum = new Date(protokollRecord.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
            <p className="font-semibold text-secondary text-center">Protokoll wirklich löschen?</p>
            <p className="text-sm text-gray-400 text-center">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
                disabled={deleting}
              >Abbrechen</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <SpinnerGap size={16} weight="bold" className="animate-spin" /> : <Trash size={16} weight="fill" />}
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Link to="/besprechung?tab=liste" className="text-gray-400 active:text-secondary">
          <ArrowLeft size={20} weight="regular" />
        </Link>
        <h1 className="font-bold text-secondary text-lg flex-1 truncate">
          {protokollRecord.betrifft || 'Protokoll'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 active:border-primary active:text-primary transition-colors"
          >
            <Printer size={14} />
            Drucken
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-400 active:text-red-500 p-1.5 transition-colors"
          >
            <Trash size={16} weight="regular" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="card space-y-3 print:shadow-none print:border-none print:p-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[protokollRecord.status] || STATUS_COLOR.entwurf}`}>
            {STATUS_LABEL[protokollRecord.status] || protokollRecord.status}
          </span>
          <span className="text-xs text-gray-400">{datum}</span>
          {zusatzCount > 0 && (
            <span className="text-xs text-orange-600 font-medium">
              ⚠ {zusatzCount} Zusatzleistung{zusatzCount !== 1 ? 'en' : ''}
            </span>
          )}
        </div>

        {/* Status Actions */}
        <div className="flex gap-2 print:hidden flex-wrap">
          {protokollRecord.status === 'entwurf' && (
            <button
              onClick={() => handleStatusUpdate('in_bearbeitung')}
              disabled={updatingStatus}
              className="flex-1 text-sm py-2 rounded-xl bg-blue-500 text-white font-semibold active:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle size={15} weight="fill" />
              Als in Bearbeitung markieren
            </button>
          )}
          {protokollRecord.status === 'in_bearbeitung' && (
            <>
              <button
                onClick={() => handleStatusUpdate('abgeschlossen')}
                disabled={updatingStatus}
                className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle size={15} weight="fill" />
                Als abgeschlossen markieren
              </button>
              <button
                onClick={() => handleStatusUpdate('entwurf')}
                disabled={updatingStatus}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Zurück zu Entwurf
              </button>
            </>
          )}
          {protokollRecord.status === 'abgeschlossen' && (
            <button
              onClick={() => handleStatusUpdate('in_bearbeitung')}
              disabled={updatingStatus}
              className="btn-secondary flex-1 text-sm py-2"
            >
              Zurück zu In Bearbeitung
            </button>
          )}
          <button
            onClick={handleSaveData}
            disabled={savingData || !editedProtokoll}
            className="btn-secondary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {savingData
              ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
              : <CheckCircle size={14} weight="fill" className="text-green-600" />
            }
            Änderungen speichern
          </button>
        </div>
      </div>

      {/* Protocol Content */}
      <div className="card print:shadow-none print:border-none print:p-0">
        <ProtokollEditor protokoll={protokoll} onChange={setEditedProtokoll} />
      </div>

      {/* Fotos & Videos */}
      <div className="card space-y-3 print:hidden">
        <p className="text-sm font-semibold text-secondary">
          Fotos &amp; Videos {media.length > 0 && <span className="text-gray-400 font-normal">({media.length})</span>}
        </p>
        {mediaLoading && (
          <div className="flex justify-center py-4">
            <SpinnerGap size={24} weight="bold" className="text-primary animate-spin" />
          </div>
        )}
        {!mediaLoading && media.length === 0 && (
          <p className="text-xs text-gray-400">Keine Medien vorhanden</p>
        )}
        {!mediaLoading && media.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {media.map(item => {
              const isVideo = item.file_type?.startsWith('video/')
              const url = item.signed_url
              return (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer active:opacity-80"
                  onClick={() => isVideo ? window.open(url, '_blank') : setLightbox(url)}
                >
                  {isVideo ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <span className="text-3xl">▶️</span>
                    </div>
                  ) : url ? (
                    <img src={url} alt={item.file_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-xs text-gray-400">Kein Bild</span>
                    </div>
                  )}
                  {url && (
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        try {
                          const res = await fetch(url)
                          const blob = await res.blob()
                          const blobUrl = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = blobUrl
                          a.download = item.file_name || 'download'
                          document.body.appendChild(a); a.click(); document.body.removeChild(a)
                          URL.revokeObjectURL(blobUrl)
                        } catch { /* ignore */ }
                      }}
                      className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                    >↓</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {!mediaLoading && media.length > 0 && (
          <button
            onClick={handleDownloadAll}
            disabled={!!downloadProgress}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 active:border-primary active:text-primary disabled:opacity-60 transition-colors"
          >
            {downloadProgress ? (
              <><SpinnerGap size={16} weight="bold" className="animate-spin" />Lade {downloadProgress.current} von {downloadProgress.total}...</>
            ) : (
              <><DownloadSimple size={16} weight="bold" />Alle Fotos &amp; Videos herunterladen</>
            )}
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Nachtrag Button */}
      {zusatzCount > 0 && (
        <button
          onClick={handleNachtragsangebot}
          className="w-full py-3 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-700 font-semibold text-sm active:bg-orange-100 transition-colors flex items-center justify-center gap-2 print:hidden"
        >
          ⚡ Nachtragsangebot generieren ({zusatzCount} Zusatzleistung{zusatzCount !== 1 ? 'en' : ''})
        </button>
      )}

      {/* Einträge (collapsible reference) */}
      {protokollRecord.eintraege?.length > 0 && (
        <details className="card print:hidden">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer select-none py-1">
            Original-Einträge anzeigen ({protokollRecord.eintraege.length})
          </summary>
          <div className="space-y-2 mt-3">
            {protokollRecord.eintraege.map(e => (
              <div key={e.id} className="flex gap-2 items-start p-2 bg-gray-50 rounded-lg">
                <span className="text-xs font-bold text-primary w-4 flex-shrink-0">{e.nr}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{e.time}</p>
                  <p className="text-xs text-gray-600">{e.text}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* PDF generieren & versenden */}
      {user && (
        <div className="card space-y-3 print:hidden">
          <p className="text-sm font-semibold text-secondary">PDF generieren &amp; versenden</p>
          <PdfEmailSender
            generatePdf={() => generateProtokollPdf({
              betrifft: protokollRecord.betrifft,
              adresse: protokollRecord.adresse,
              projektnummer: protokollRecord.hero_projektnummer,
              protokoll: editedProtokoll || protokollRecord.protokoll_data || {},
              userName: profile?.name || user?.email || '',
              userEmail: profile?.email || user?.email || '',
              datum: datum,
            })}
            betreff={`Besprechungsprotokoll: ${protokollRecord.betrifft || ''}`}
            projektnummer={protokollRecord.hero_projektnummer}
            adresse={protokollRecord.adresse}
            betrifft={protokollRecord.betrifft}
            pdfFilename={`Protokoll_${protokollRecord.hero_projektnummer || 'neu'}_${(protokollRecord.betrifft || 'Protokoll').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_')}.pdf`}
            angebotLink={`${window.location.origin}/protokoll/${id}`}
            type="protokoll"
          />
        </div>
      )}

      {/* E-Mail versenden */}
      {user && (
        <div className="card space-y-3 print:hidden">
          <p className="text-sm font-semibold text-secondary">Protokoll per E-Mail versenden</p>
          {!sent ? (
            <>
              {profile?.role !== 'bauleiter' && bauleiterList.length > 0 && (
                <select
                  className="input-field"
                  value={selectedBauleiter}
                  onChange={e => setSelectedBauleiter(e.target.value)}
                >
                  <option value="">– Bauleiter auswählen –</option>
                  {bauleiterList.map(bl => (
                    <option key={bl.id} value={bl.id}>{bl.name || bl.email}</option>
                  ))}
                </select>
              )}
              {profile?.role === 'bauleiter' && (
                <p className="text-xs text-gray-400">E-Mail wird an dich selbst gesendet ({profile?.email || user?.email})</p>
              )}
              {!SUPABASE_URL ? (
                <p className="text-xs text-gray-400 text-center py-2">E-Mail-Versand nicht konfiguriert</p>
              ) : (
                <button
                  onClick={handleSendBauleiter}
                  disabled={sending}
                  className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending
                    ? <><SpinnerGap size={16} weight="bold" className="animate-spin" />Wird gesendet...</>
                    : <><PaperPlaneTilt size={16} weight="fill" />{profile?.role === 'bauleiter' ? 'E-Mail an mich senden' : selectedBauleiter ? 'An Bauleiter senden' : 'E-Mail senden'}</>
                  }
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <Envelope size={16} weight="regular" className="flex-shrink-0" />
              <span className="text-sm">E-Mail wurde an {sentName} gesendet!</span>
            </div>
          )}
        </div>
      )}

      {/* Back */}
      <div className="pb-4 print:hidden">
        <Link to="/besprechung?tab=liste" className="btn-secondary w-full text-center block">
          Zur Übersicht
        </Link>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-2xl, .max-w-2xl * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .max-w-2xl { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
        }
      `}</style>
    </div>
  )
}
