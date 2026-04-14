import { useState, useEffect } from 'react'
import { SpinnerGap, FloppyDisk, CheckCircle, Envelope, PaperPlaneTilt, ClipboardText, DownloadSimple } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { getFreshAccessToken } from '../lib/supabase.js'
import { saveOffer, updateOffer, assignBauleiter, loadBauleiter } from '../lib/offers.js'
import { uploadOfferMedia } from '../lib/media.js'
import { buildAngebotHtml } from '../lib/emailHtml.js'
import { generateMagicLink } from '../lib/magicLink.js'

const isDev = import.meta.env.DEV

const FALLBACK_BAULEITER = [
  { id: 'celik', name: 'Ümit Celik', email: 'info@napetschnig.at', isFallback: true },
  { id: 'lucic', name: 'Dijan Lucic', email: 'info@napetschnig.at', isFallback: true },
]

const LUKASZ_ENTRY = { id: 'lukasz', name: 'Christoph Napetschnig', email: 'napetschnig.chris@gmail.com', isFallback: true }

// Circular progress SVG
function CircularProgress({ percent }) {
  const R = 36
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - percent / 100)
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={R} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={R} fill="none"
        stroke="#3a3a3a" strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="48" y="48"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 18, fontWeight: 700, fill: '#2c3e50' }}
      >
        {percent}%
      </text>
    </svg>
  )
}

export default function SaveOfferButton({ betrifft, adresse, projektnummer, gewerke, netto, mwst, brutto, eingabeText, mediaFiles = [], ergaenzungen = [], hinweise = [], autoSave = false, onSaved, existingId = null, children }) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(existingId)
  const [saveError, setSaveError] = useState(false)

  // Media upload progress
  const [uploadPhase, setUploadPhase] = useState(null) // null | 'uploading' | 'done'
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadCount, setUploadCount] = useState(0)

  const [bauleiterList, setBauleiterList] = useState([])
  const [selectedBauleiter, setSelectedBauleiter] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentName, setSentName] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(null) // null | { current, total }

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

  // Track whether media was already uploaded for this saved offer
  const [mediaUploaded, setMediaUploaded] = useState(false)

  // Sync existingId from parent (e.g. after remount)
  useEffect(() => {
    if (existingId && !savedId) {
      setSavedId(existingId)
      if (onSaved) onSaved(existingId)
    }
  }, [existingId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: wartet bis user geladen ist, dann sofort speichern
  useEffect(() => {
    if (autoSave && !savedId && !saving && user) {
      isDev && console.log('AutoSave: User bereit, starte Speichern…')
      handleSave()
    }
  }, [autoSave, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nachträglicher Medien-Upload: Wenn Angebot bereits gespeichert und neue Medien hinzukommen
  useEffect(() => {
    if (!savedId || !mediaFiles.length || mediaUploaded || uploadPhase) return
    isDev && console.log('Nachträglicher Medien-Upload: savedId vorhanden, mediaFiles:', mediaFiles.length)
    async function uploadLateMedia() {
      setUploadPhase('uploading')
      setUploadPercent(0)
      setUploadCount(mediaFiles.length)
      setUploadLabel(mediaFiles[0]?.isVideo ? 'Video wird hochgeladen...' : `Foto 1 von ${mediaFiles.length} wird hochgeladen...`)
      try {
        await uploadOfferMedia(savedId, mediaFiles, ({ percent, current, total, isVideo, done }) => {
          setUploadPercent(percent)
          if (!done) {
            setUploadLabel(isVideo
              ? `Video wird hochgeladen...`
              : `Foto ${current} von ${total} wird hochgeladen...`)
          }
        })
        setUploadPercent(100)
        setMediaUploaded(true)
        setUploadPhase('done')
        showToast(`${mediaFiles.length} ${mediaFiles.length === 1 ? 'Medium' : 'Medien'} hochgeladen!`)
        setTimeout(() => setUploadPhase(null), 3000)
      } catch (uploadErr) {
        console.error('Nachträglicher Medien-Upload Fehler:', uploadErr?.message, uploadErr)
        showToast(`Medien-Upload fehlgeschlagen: ${uploadErr?.message || 'Unbekannter Fehler'}`, 'error')
        setUploadPhase(null)
      }
    }
    uploadLateMedia()
  }, [savedId, mediaFiles, mediaUploaded, uploadPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  const angebotLink = savedId ? `${window.location.origin}/angebot/${savedId}` : ''

  async function handleSave() {
    if (!user) return
    isDev && console.log('Starte Speichern. mediaFiles:', mediaFiles.length, mediaFiles.map(f => ({ name: f.file?.name, size: f.file?.size, type: f.file?.type, isFile: f.file instanceof File })))
    setSaving(true)
    setSaveError(false)
    try {
      let data
      if (savedId) {
        // UPDATE: Bestehendes Angebot aktualisieren (kein neues anlegen!)
        await updateOffer(savedId, {
          betrifft,
          angebotData: { gewerke, netto, mwst, brutto, betreff: betrifft, _adresse: adresse || '' },
          ergaenzungen,
          hinweise,
        })
        data = { id: savedId }
        isDev && console.log('Angebot aktualisiert (UPDATE):', savedId)
      } else {
        // INSERT: Neues Angebot erstellen
        data = await saveOffer({
          userId: user.id,
          erstellerName: profile?.name || user.email,
          betrifft,
          projektnummer,
          eingabeText,
          angebotData: { gewerke, netto, mwst, brutto, betreff: betrifft, _adresse: adresse || '' },
          ergaenzungen,
          hinweise,
        })
        isDev && console.log('Neues Angebot erstellt (INSERT):', data.id)
      }

      if (mediaFiles.length > 0) {
        setSaving(false)
        setUploadPhase('uploading')
        setUploadPercent(0)
        setUploadCount(mediaFiles.length)
        setUploadLabel(mediaFiles[0]?.isVideo ? 'Video wird hochgeladen...' : `Foto 1 von ${mediaFiles.length} wird hochgeladen...`)
        try {
          await uploadOfferMedia(data.id, mediaFiles, ({ percent, current, total, isVideo, done }) => {
            setUploadPercent(percent)
            if (!done) {
              setUploadLabel(isVideo
                ? `Video wird hochgeladen...`
                : `Foto ${current} von ${total} wird hochgeladen...`)
            }
          })
          setUploadPercent(100)
          setMediaUploaded(true)
          setUploadPhase('done')
          setTimeout(() => {
            setSavedId(data.id)
            setUploadPhase(null)
            if (onSaved) onSaved(data.id)
          }, 3000)
        } catch (uploadErr) {
          console.error('Medien Upload Fehler:', uploadErr?.message, uploadErr)
          if (uploadErr?.message?.toLowerCase().includes('bucket') || uploadErr?.statusCode === 404) {
            isDev && console.warn("Bitte Supabase Storage Bucket 'offer-media' manuell erstellen: Supabase Dashboard → Storage → New Bucket → Name: 'offer-media' → Public: false")
          }
          showToast(`Angebot gespeichert, aber Medien-Upload fehlgeschlagen: ${uploadErr?.message || 'Unbekannter Fehler'}`, 'error')
          setSavedId(data.id)
          setUploadPhase(null)
        }
      } else {
        setSavedId(data.id)
        if (onSaved) onSaved(data.id)
        if (autoSave) {
          showToast('✓ Angebot automatisch gespeichert')
        } else {
          showToast('Angebot gespeichert!')
        }
      }
    } catch (err) {
      setSaveError(true)
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(angebotLink)
      .then(() => showToast('Link kopiert!'))
      .catch(() => showToast('Kopieren fehlgeschlagen', 'error'))
  }

  async function handleDownloadAll() {
    setDownloadProgress({ current: 0, total: mediaFiles.length })
    for (let i = 0; i < mediaFiles.length; i++) {
      const mf = mediaFiles[i]
      setDownloadProgress({ current: i + 1, total: mediaFiles.length })
      try {
        const blobUrl = URL.createObjectURL(mf.file)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = mf.file.name || `media_${i + 1}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      } catch (e) {
        isDev && console.warn('Download fehlgeschlagen:', mf.file?.name, e)
      }
      if (i < mediaFiles.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    setDownloadProgress(null)
  }

  async function handleSend() {
    if (!savedId) return
    const bl = bauleiterList.find(b => b.id === selectedBauleiter) || {
      email: profile?.email || user?.email || '',
      name: profile?.name || user?.email || 'Unbekannt',
      isFallback: true,
    }
    setSending(true)
    try {
      if (!bl.isFallback) {
        await assignBauleiter(savedId, selectedBauleiter)
      }
      const erstelltVon = profile?.name || user?.email || '–'

      // Magic Link generieren – Bauleiter wird automatisch eingeloggt
      let linkForEmail = angebotLink
      try {
        linkForEmail = await generateMagicLink(bl.email, angebotLink)
      } catch {
        // Fallback auf normalen Link wenn Edge Function nicht erreichbar
        linkForEmail = angebotLink
      }

      const htmlBody = buildAngebotHtml({
        betrifft, adresse, projektnummer, gewerke,
        netto, mwst, brutto, angebotLink: linkForEmail, erstelltVon,
        empfaenger: bl.email, ergaenzungen,
      })
      const userToken = await getFreshAccessToken()
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': userToken,
        },
        body: JSON.stringify({
          empfaenger: bl.email,
          betreff: `Neues Angebot: ${betrifft || 'Angebot'}`,
          angebotLink: linkForEmail,
          projektNummer: projektnummer || '–',
          adresse: adresse || '–',
          betrifft: betrifft || '–',
          gesamtsummeNetto: Number(netto || 0).toFixed(2),
          gesamtsummeBrutto: Number(brutto || 0).toFixed(2),
          absenderName: profile?.name || user?.email || '–',
          absenderEmail: profile?.email || user?.email || '',
          htmlBody,
        }),
      })
      if (!res.ok) {
        let detail = `Status ${res.status}`
        try {
          const errBody = await res.json()
          detail = errBody?.error || errBody?.message || detail
        } catch { /* ignore */ }
        throw new Error(`Webhook Fehler: ${detail}`)
      }
      const name = bl.name || bl.email
      setSentName(name)
      setSent(true)
      showToast(`E-Mail wurde an ${name} gesendet!`)
    } catch (err) {
      console.error('[SaveOfferButton] E-Mail-Versand Fehler:', err?.message, err)
      showToast(`E-Mail-Versand fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`, 'error')
    } finally {
      setSending(false)
    }
  }

  // Auto-save: Speichern läuft oder wartet auf User
  if (autoSave && !savedId && !saveError) {
    return (
      <div className="card flex items-center gap-3 py-3">
        <SpinnerGap size={18} weight="bold" className="text-primary animate-spin flex-shrink-0" />
        <span className="text-sm text-gray-500">Angebot wird gespeichert…</span>
      </div>
    )
  }

  // Media upload in progress
  if (uploadPhase === 'uploading') {
    return (
      <div className="card space-y-4 py-5">
        <div className="flex flex-col items-center gap-3">
          <CircularProgress percent={uploadPercent} />
          <p className="text-sm text-gray-600 text-center">{uploadLabel}</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-400"
            style={{ width: `${uploadPercent}%` }}
          />
        </div>
      </div>
    )
  }

  // Upload complete – brief success message
  if (uploadPhase === 'done') {
    return (
      <div className="card flex items-center gap-3 py-4">
        <CheckCircle size={22} weight="fill" className="text-green-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-green-700">
          Angebot und {uploadCount} {uploadCount === 1 ? 'Medium' : 'Medien'} gespeichert
        </span>
      </div>
    )
  }

  // Auto-save failed: show fallback button
  if (autoSave && saveError && !savedId) {
    return (
      <div className="card border-t-4 border-t-red-400 space-y-2">
        <p className="text-sm text-red-500">Automatisches Speichern fehlgeschlagen.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm active:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <FloppyDisk size={18} weight="regular" />
          Angebot speichern
        </button>
      </div>
    )
  }

  // Manual save: not yet saved
  if (!autoSave && !savedId) {
    return (
      <div className="card border-t-4 border-t-green-600">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-base active:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <SpinnerGap size={20} weight="bold" className="animate-spin" />
              Speichern...
            </>
          ) : (
            <>
              <FloppyDisk size={20} weight="regular" />
              Angebot speichern
            </>
          )}
        </button>
      </div>
    )
  }

  // Saved – show link + send options
  return (
    <div className="card border-t-4 border-t-green-600 space-y-4">
      <div className="flex items-center gap-2 text-green-700">
        <CheckCircle size={20} weight="fill" className="flex-shrink-0" />
        <span className="font-semibold">{autoSave ? 'Automatisch gespeichert' : 'Angebot gespeichert'}</span>
      </div>

      <div>
        <p className="label mb-1">Link zum Angebot</p>
        <div className="flex gap-2">
          <div className="input-field flex-1 text-xs truncate text-gray-500 bg-gray-50 py-3 select-all">
            {angebotLink}
          </div>
          <button
            onClick={handleCopyLink}
            className="btn-secondary px-4 flex-shrink-0 text-sm flex items-center gap-1.5"
          >
            <ClipboardText size={16} weight="regular" />
            Kopieren
          </button>
        </div>
      </div>

      {mediaFiles.length > 0 && (
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

      {/* Slot for PdfEmailSender or other content between link and send */}
      {children}

      {!sent ? (
        <div className="space-y-3 pt-1 border-t border-gray-100">
          <p className="text-sm font-medium text-secondary">Angebot senden</p>
          {profile?.role !== 'bauleiter' && bauleiterList.length > 0 && (
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
          )}
          {profile?.role === 'bauleiter' && (
            <p className="text-xs text-gray-400">
              E-Mail wird an dich selbst gesendet ({profile?.email || user?.email})
            </p>
          )}
          <button
            onClick={handleSend}
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
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-600 pt-1 border-t border-gray-100">
          <Envelope size={16} weight="regular" className="flex-shrink-0" />
          <span className="text-sm">E-Mail wurde an {sentName} gesendet!</span>
        </div>
      )}
    </div>
  )
}
