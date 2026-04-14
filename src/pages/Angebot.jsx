import { useState, useEffect } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom'
import { SpinnerGap, PaperPlaneTilt, Envelope, Trash, DownloadSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase, getEdgeFunctionHeaders, getFreshAccessToken } from '../lib/supabase.js'
import { loadOffer, updateOfferStatus, assignBauleiter, loadBauleiter, deleteOffer, updateErgaenzungen, updateHinweise } from '../lib/offers.js'
import { buildAngebotHtml } from '../lib/emailHtml.js'
import { generateMagicLink } from '../lib/magicLink.js'
import { loadOfferMedia, deleteOfferMedia } from '../lib/media.js'
import { generateAngebotPdf } from '../lib/pdfGenerator.js'
import GewerkeBlock from '../components/GewerkeBlock.jsx'
import OfferSummary from '../components/OfferSummary.jsx'
import CopyField from '../components/CopyField.jsx'
import ErgaenzungenEditor from '../components/ErgaenzungenEditor.jsx'
import HinweiseEditor from '../components/HinweiseEditor.jsx'
import PdfEmailSender from '../components/PdfEmailSender.jsx'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const STATUS_LABEL = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  draft: 'Entwurf',
}

const STATUS_COLOR = {
  entwurf: 'bg-gray-100 text-gray-600',
  gesendet: 'bg-blue-100 text-blue-700',
  in_bearbeitung: 'bg-yellow-100 text-yellow-700',
  abgeschlossen: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
}

const FALLBACK_BAULEITER = []

const ADMIN_ENTRY = { id: 'admin', name: 'Christoph Napetschnig', email: 'napetschnig.chris@gmail.com', isFallback: true }

export default function AngebotView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [bauleiterList, setBauleiterList] = useState([])
  const [selectedBauleiter, setSelectedBauleiter] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentName, setSentName] = useState('')
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState(null)
  const [lightbox, setLightbox] = useState(null) // signed_url string oder null
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null) // null | { current, total }
  const [ergaenzungen, setErgaenzungenState] = useState([])
  const [hinweise, setHinweiseState] = useState([])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    loadOffer(id)
      .then(data => {
        setOffer(data)
        setErgaenzungenState(data?.ergaenzungen || [])
        setHinweiseState(data?.hinweise || [])
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadBauleiter()
      .then(list => {
        const base = list.length > 0 ? list : FALLBACK_BAULEITER
        const merged = [...base, ADMIN_ENTRY]
        const seen = new Set()
        setBauleiterList(merged.filter(b => {
          if (seen.has(b.email)) return false
          seen.add(b.email)
          return true
        }))
      })
      .catch(() => setBauleiterList([...FALLBACK_BAULEITER, ADMIN_ENTRY]))
  }, [])

  useEffect(() => {
    if (!id) return
    setMediaLoading(true)
    setMediaError(null)
    loadOfferMedia(id)
      .then(data => {
        console.log('Medien geladen:', data)
        setMedia(data)
      })
      .catch(err => {
        console.error('Medien Ladefehler:', err.message, err)
        setMediaError(err.message)
      })
      .finally(() => setMediaLoading(false))
  }, [id])

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteOfferMedia(id)
      await deleteOffer(id)
      showToast('Angebot gelöscht')
      navigate('/kalkulation?modus=angebote', { replace: true })
    } catch (err) {
      showToast(err.message, 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

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
      } catch (e) {
        console.warn('Download fehlgeschlagen:', item.file_name, e)
      }
      if (i < media.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    setDownloadProgress(null)
  }

  async function handleErgaenzungenChange(newList) {
    setErgaenzungenState(newList)
    try {
      await updateErgaenzungen(id, newList)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleHinweiseChange(newList) {
    setHinweiseState(newList)
    try {
      await updateHinweise(id, newList)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleStatusUpdate(newStatus) {
    setUpdatingStatus(true)
    try {
      await updateOfferStatus(id, newStatus)
      setOffer(prev => ({ ...prev, status: newStatus }))
      showToast('Status aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUpdatingStatus(false)
    }
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
      if (!bl.isFallback) {
        await assignBauleiter(id, selectedBauleiter)
      }

      // Magic Link generieren – Bauleiter wird automatisch eingeloggt
      let linkForEmail = angebotLink
      try {
        linkForEmail = await generateMagicLink(bl.email, angebotLink)
      } catch {
        // Fallback auf normalen Link wenn Edge Function nicht erreichbar
        linkForEmail = angebotLink
      }

      const htmlBody = buildAngebotHtml({
        betrifft: offer.betrifft,
        adresse,
        projektnummer: offer.hero_projektnummer,
        gewerke,
        netto, mwst, brutto,
        angebotLink: linkForEmail,
        erstelltVon: erstellerName || profile?.name || user?.email || '–',
        empfaenger: bl.email,
        ergaenzungen,
        hinweise,
      })
      const userToken = await getFreshAccessToken()
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': userToken },
        body: JSON.stringify({
          empfaenger: bl.email,
          betreff: `Neues Angebot: ${offer.betrifft || 'Angebot'}`,
          angebotLink: linkForEmail,
          projektNummer: offer.hero_projektnummer || '–',
          adresse: adresse || '–',
          betrifft: offer.betrifft || '–',
          gesamtsummeNetto: Number(netto || 0).toFixed(2),
          gesamtsummeBrutto: Number(brutto || 0).toFixed(2),
          absenderName: profile?.name || user?.email || '–',
          absenderEmail: profile?.email || user?.email || '',
          htmlBody,
        }),
      })
      if (!res.ok) throw new Error(`Webhook Fehler: ${res.status}`)
      const name = bl.name || bl.email
      setSentName(name)
      setSent(true)
      showToast(`E-Mail wurde an ${name} gesendet!`)
    } catch (err) {
      showToast('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.', 'error')
    } finally {
      setSending(false)
    }
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SpinnerGap size={40} weight="bold" className="text-primary animate-spin" />
          <p className="text-sm text-gray-500">Angebot wird geladen...</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="card text-center py-8 space-y-3">
          <p className="text-red-500 font-medium">Angebot konnte nicht geladen werden</p>
          <p className="text-sm text-gray-400">{fetchError}</p>
          <Link to="/kalkulation?modus=angebote" className="btn-secondary inline-block mt-2">Zurück zur Angebotsliste</Link>
        </div>
      </div>
    )
  }

  if (!offer) return null

  const angebotData = offer.angebot_data || {}
  const gewerke = angebotData.gewerke || []
  const netto = offer.gesamtsumme_netto || angebotData.netto || 0
  const mwst = netto * 0.2
  const brutto = offer.gesamtsumme_brutto || angebotData.brutto || 0
  const erstellerName = angebotData._ersteller_name || '–'
  const adresse = angebotData._adresse || angebotData.adresse || ''
  const angebotLink = `${window.location.origin}/angebot/${id}`

  const status = offer.status || 'entwurf'
  const datumFormatiert = new Date(offer.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Confirm-Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl">
            <p className="font-semibold text-secondary text-center">Angebot wirklich löschen?</p>
            <p className="text-sm text-gray-400 text-center">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
                disabled={deleting}
              >
                Abbrechen
              </button>
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

      {/* Meta header */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-secondary text-lg leading-tight">
              {offer.betrifft || 'Angebot'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Erstellt von <span className="font-medium text-gray-600">{erstellerName}</span> am {datumFormatiert}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_COLOR[status] || STATUS_COLOR.entwurf}`}>
              {STATUS_LABEL[status] || status}
            </span>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-gray-400 active:text-red-500 px-2 py-1 rounded-lg active:bg-red-50 transition-colors"
              title="Angebot löschen"
            >
              <Trash size={15} weight="regular" />
              Löschen
            </button>
          </div>
        </div>

        <CopyField label="Hero Projektnummer" value={offer.hero_projektnummer} />
        {adresse && (
          <CopyField label="Adresse" value={adresse} />
        )}
        {offer.betrifft && (
          <CopyField label="Betrifft" value={offer.betrifft} />
        )}

        {/* Status actions */}
        <div className="flex gap-2 pt-1 flex-wrap">
          {status !== 'in_bearbeitung' && status !== 'abgeschlossen' && (
            <button
              onClick={() => handleStatusUpdate('in_bearbeitung')}
              disabled={updatingStatus}
              className="btn-secondary flex-1 text-sm py-2.5 min-w-0"
            >
              Als in Bearbeitung markieren
            </button>
          )}
          {status !== 'abgeschlossen' && (
            <button
              onClick={() => handleStatusUpdate('abgeschlossen')}
              disabled={updatingStatus}
              className="btn-primary flex-1 text-sm py-2.5 min-w-0"
            >
              Als abgeschlossen markieren
            </button>
          )}
        </div>
      </div>

      {/* Fotos / Videos – direkt vor den Gewerken, immer sichtbar */}
      <div className="card space-y-3">
        <p className="text-sm font-semibold text-secondary">
          Fotos &amp; Videos {media.length > 0 && <span className="text-gray-400 font-normal">({media.length})</span>}
        </p>

        {mediaLoading && (
          <div className="flex justify-center py-4">
            <SpinnerGap size={24} weight="bold" className="text-primary animate-spin" />
          </div>
        )}

        {!mediaLoading && mediaError && (
          <p className="text-xs text-red-500">Fehler beim Laden: {mediaError}</p>
        )}

        {!mediaLoading && !mediaError && media.length === 0 && (
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
                    <img
                      src={url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { e.target.style.display = 'none'; console.warn('Bild konnte nicht geladen werden:', url) }}
                    />
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
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(blobUrl)
                        } catch (e) {
                          console.warn('Download fehlgeschlagen:', item.file_name, e)
                        }
                      }}
                      className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                      title="Herunterladen"
                    >
                      ↓
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Download-Button */}
        {!mediaLoading && media.length > 0 && (
          <button
            onClick={handleDownloadAll}
            disabled={!!downloadProgress}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 active:border-primary active:text-primary disabled:opacity-60 transition-colors"
          >
            {downloadProgress ? (
              <>
                <SpinnerGap size={16} weight="bold" className="animate-spin flex-shrink-0" />
                Lade Datei {downloadProgress.current} von {downloadProgress.total}...
              </>
            ) : (
              <>
                <DownloadSimple size={16} weight="bold" className="flex-shrink-0" />
                Alle Fotos &amp; Videos herunterladen
              </>
            )}
          </button>
        )}
      </div>

      {/* Ergänzungen */}
      <ErgaenzungenEditor ergaenzungen={ergaenzungen} onChange={handleErgaenzungenChange} />

      {/* Hinweise */}
      <HinweiseEditor hinweise={hinweise} onChange={handleHinweiseChange} />

      {/* Gewerke */}
      {gewerke.map((gewerk, idx) => (
        <GewerkeBlock
          key={idx}
          gewerk={gewerk}
          editDisabled={true}
        />
      ))}

      {/* Summary */}
      {gewerke.length > 0 && (
        <OfferSummary netto={netto} mwst={mwst} brutto={brutto} gewerke={gewerke} />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}

      {/* PDF per E-Mail an beliebigen Empfänger */}
      <div className="card space-y-3">
        <p className="text-sm font-semibold text-secondary">PDF generieren &amp; versenden</p>
        <PdfEmailSender
          generatePdf={() => generateAngebotPdf({
            betrifft: offer.betrifft,
            adresse,
            projektnummer: offer.hero_projektnummer,
            gewerke,
            netto,
            mwst,
            brutto,
            ergaenzungen,
            hinweise,
            userName: profile?.name || user?.email || 'Christoph Napetschnig',
            userEmail: profile?.email || user?.email || '',
            datum: datumFormatiert,
            empfaenger: offer.angebot_data?._empfaenger || '',
          })}
          betreff={`Angebot ${offer.hero_projektnummer || ''} – ${offer.betrifft || ''}`}
          projektnummer={offer.hero_projektnummer}
          adresse={adresse}
          betrifft={offer.betrifft}
          pdfFilename={`Angebot-${offer.hero_projektnummer || 'neu'}-${(offer.betrifft || 'Angebot').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '').replace(/\s+/g, '')}-${datumFormatiert.replace(/\./g, '-')}.pdf`}
          angebotLink={angebotLink}
          type="angebot"
        />
      </div>

      {/* E-Mail versenden */}
      <div className="card space-y-3">
        <p className="text-sm font-semibold text-secondary">Angebot versenden</p>

        {!sent ? (
          <div className="space-y-2">
            {profile?.role !== 'bauleiter' && bauleiterList.length > 0 && (
              <>
                <p className="text-xs text-gray-500">An Bauleiter senden</p>
                <select
                  className="input-field"
                  value={selectedBauleiter}
                  onChange={e => setSelectedBauleiter(e.target.value)}
                >
                  <option value="">– Bauleiter auswählen –</option>
                  {bauleiterList.map(bl => (
                    <option key={bl.id} value={bl.id}>
                      {bl.name || bl.email}
                    </option>
                  ))}
                </select>
              </>
            )}
            {profile?.role === 'bauleiter' && (
              <p className="text-xs text-gray-400">
                E-Mail wird an dich selbst gesendet ({profile?.email || user?.email})
              </p>
            )}
            {!SUPABASE_URL ? (
              <p className="text-xs text-gray-400 text-center py-2">E-Mail-Versand nicht konfiguriert</p>
            ) : (
              <button
                onClick={handleSendBauleiter}
                disabled={sending}
                className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <SpinnerGap size={16} weight="bold" className="animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt size={16} weight="fill" />
                    {profile?.role === 'bauleiter' ? 'E-Mail an mich senden' : selectedBauleiter ? 'An Bauleiter senden' : 'E-Mail senden'}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <Envelope size={16} weight="regular" className="flex-shrink-0" />
            <span className="text-sm">E-Mail wurde an {sentName} gesendet!</span>
          </div>
        )}

      </div>

      {/* Back */}
      <div className="pb-4">
        <Link to="/kalkulation?modus=angebote" className="btn-secondary w-full text-center block">
          Zurück zur Angebotsliste
        </Link>
      </div>
    </div>
  )
}
