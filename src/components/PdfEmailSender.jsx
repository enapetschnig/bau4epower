import { useState, useEffect } from 'react'
import { SpinnerGap, Envelope, FilePdf, Eye } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadEmpfaenger, saveEmpfaenger } from '../lib/empfaenger.js'
import { getFreshAccessToken } from '../lib/supabase.js'
import { buildPdfEmailHtml } from '../lib/emailHtml.js'
import EmailAutocomplete from './EmailAutocomplete.jsx'

/**
 * Wiederverwendbare Komponente zum Generieren, Vorschauen und Versenden eines PDFs per E-Mail.
 *
 * Sendet an Make.com Webhook:
 *   - htmlBody: Schöne HTML-E-Mail ("Anbei erhalten Sie das Angebot als PDF")
 *   - pdfBase64 + pdfFilename: Die PDF-Datei als Base64-Anhang
 *   - istPdfAnhang: true → Signal an Make.com, PDF als Anhang anzuhängen
 *
 * Props:
 *   generatePdf: async () => Blob
 *   betreff:    string
 *   projektnummer: string
 *   adresse:    string
 *   betrifft:   string
 *   pdfFilename: string
 *   angebotLink: string
 *   type:       'angebot' | 'protokoll'
 */
export default function PdfEmailSender({
  generatePdf,
  betreff,
  projektnummer,
  adresse,
  betrifft,
  pdfFilename,
  angebotLink,
  type = 'angebot',
}) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  const [empfaengerList, setEmpfaengerList] = useState([])
  const [email, setEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!user) return
    loadEmpfaenger(user.id).then(setEmpfaengerList).catch(() => {})
  }, [user])

  // iOS / iPadOS erkennen
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // PDF Vorschau – iOS-kompatibel
  async function handlePreview() {
    setPreviewing(true)
    try {
      const pdfBlob = await generatePdf()
      const blobUrl = URL.createObjectURL(pdfBlob)

      if (isIOS) {
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = pdfFilename || 'Angebot.pdf'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      } else {
        window.open(blobUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      }
    } catch (err) {
      showToast('PDF konnte nicht generiert werden: ' + err.message, 'error')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSend() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      showToast('Bitte eine gültige E-Mail-Adresse eingeben.', 'error')
      return
    }

    setGenerating(true)
    let pdfBlob
    try {
      pdfBlob = await generatePdf()
    } catch (err) {
      showToast('PDF konnte nicht generiert werden: ' + err.message, 'error')
      setGenerating(false)
      return
    }
    setGenerating(false)
    setSending(true)

    try {
      // Blob → Base64
      const pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })

      const label = type === 'protokoll' ? 'Besprechungsprotokoll' : 'Angebot'
      const emailBetreff = type === 'angebot'
        ? `Angebot ${projektnummer || ''} – ${betrifft || ''}`
        : betreff || `${label}: ${betrifft || ''}`

      // HTML-E-Mail-Body generieren (wie bei "Angebot senden")
      const htmlBody = buildPdfEmailHtml({
        betrifft: betrifft || '',
        adresse: adresse || '',
        projektnummer: projektnummer || '',
        absenderName: profile?.name || user?.email || 'ET KÖNIG GmbH',
        type,
      })

      const userToken = await getFreshAccessToken()
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': userToken,
        },
        body: JSON.stringify({
          empfaenger: trimmedEmail,
          Empfanger: trimmedEmail,
          Betreff: emailBetreff,
          htmlBody,
          pdfBase64,
          pdfDateiname: pdfFilename || `${label}_${projektnummer || 'Dokument'}.pdf`,
          pdfFilename: pdfFilename || `${label}_${projektnummer || 'Dokument'}.pdf`,
          istPdfAnhang: 'true',
        }),
      })
      if (!res.ok) {
        let detail = `Status ${res.status}`
        try {
          const errBody = await res.json()
          detail = errBody?.error || errBody?.message || detail
        } catch { /* ignore parse error */ }
        throw new Error(`Webhook Fehler: ${detail}`)
      }

      // E-Mail in Empfänger-DB speichern
      if (user) {
        await saveEmpfaenger(user.id, trimmedEmail)
        loadEmpfaenger(user.id).then(setEmpfaengerList).catch(() => {})
      }

      setSent(true)
      showToast(`PDF wurde an ${trimmedEmail} gesendet!`)
    } catch (err) {
      console.error('[PdfEmailSender] Fehler:', err?.message, err)
      showToast(`PDF-Versand fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`, 'error')
    } finally {
      setSending(false)
    }
  }

  const isLoading = generating || sending || previewing

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Envelope size={16} weight="regular" className="flex-shrink-0" />
        <span className="text-sm">PDF wurde an {email} gesendet!</span>
        <button
          onClick={() => { setSent(false); setEmail('') }}
          className="text-xs text-gray-400 underline ml-auto"
        >
          Erneut senden
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Vorschau-Button */}
      <button
        onClick={handlePreview}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 active:border-primary active:text-primary disabled:opacity-50 transition-colors"
      >
        {previewing ? (
          <><SpinnerGap size={16} weight="bold" className="animate-spin" /><span>PDF wird generiert...</span></>
        ) : (
          <><Eye size={16} weight="bold" /><span>PDF Vorschau</span></>
        )}
      </button>

      {/* E-Mail senden */}
      <p className="text-xs text-gray-500">PDF per E-Mail versenden</p>

      <div className="flex gap-2">
        <EmailAutocomplete
          value={email}
          onChange={setEmail}
          empfaengerList={empfaengerList}
          disabled={isLoading}
          onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !email.trim()}
          className="btn-primary px-4 flex-shrink-0 disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <><SpinnerGap size={15} weight="bold" className="animate-spin" /><span className="text-sm">PDF...</span></>
          ) : sending ? (
            <><SpinnerGap size={15} weight="bold" className="animate-spin" /><span className="text-sm">Sende...</span></>
          ) : (
            <><FilePdf size={15} weight="fill" /><span className="text-sm">PDF senden</span></>
          )}
        </button>
      </div>

      {empfaengerList.length > 0 && !email && (
        <p className="text-xs text-gray-400">
          Zuletzt: {empfaengerList.slice(0, 3).map(e => e.email).join(', ')}
        </p>
      )}
    </div>
  )
}
