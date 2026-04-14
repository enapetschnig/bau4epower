import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Microphone, Stop, SpinnerGap, X, Plus, ClipboardText, CheckCircle, PencilSimple, PaperPlaneTilt, Envelope, ArrowsClockwise } from '@phosphor-icons/react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { callClaude, parseJsonResponse } from '../lib/claude.js'
import { saveProtokoll, uploadProtokollMedia } from '../lib/protokolle.js'
import MediaUpload from '../components/MediaUpload.jsx'
import { loadBauleiter } from '../lib/offers.js'
import { WHISPER_BAU_PROMPT, korrigiereTranskription } from '../utils/textFormat.js'
import { generateMagicLink } from '../lib/magicLink.js'
import { buildProtokollHtml } from '../lib/emailHtml.js'
import { supabase, getEdgeFunctionHeaders } from '../lib/supabase.js'

const FALLBACK_BAULEITER = [
  { id: 'celik', name: 'Ümit Celik', email: 'celik@bau4you.at', isFallback: true },
  { id: 'lucic', name: 'Dijan Lucic', email: 'lucic@bau4you.at', isFallback: true },
]
const LUKASZ_ENTRY = { id: 'lukasz', name: 'Lukasz Baranowski', email: 'ipad@bau4you.at', isFallback: true }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_WHISPER = Boolean(SUPABASE_URL)

/** Normalisiert Adresse: Top/Stiege/Hof/EG/DG mit Schrägstrich formatieren */
function formatAdresse(addr) {
  if (!addr) return addr
  return addr
    .replace(/\s+[Ss]tiege\s+(\S+)\s+[Tt]op\s+/g, '/Stiege $1/Top ')
    .replace(/\s+[Ss]tiege\s+/g, '/Stiege ')
    .replace(/\s+[Tt]op\s+/g, '/Top ')
    .replace(/\s+[Tt][uü]r\s+/g, '/Tür ')
    .replace(/\s+[Ii]m\s+[Hh]of\b/gi, '/Hof')
    .replace(/\s+[Hh]of\b/g, '/Hof')
    .replace(/\s+[Ee]rdgeschoss\b/gi, '/EG')
    .replace(/\s+\b[Ee][Gg]\b/g, '/EG')
    .replace(/\s+[Dd]achgeschoss\b/gi, '/DG')
    .replace(/\s+\b[Dd][Gg]\b/g, '/DG')
}

const SYSTEM_PROMPT = `Du bist ein Assistent für Baubesprechungsprotokolle. Erstelle aus den folgenden Gesprächsnotizen ein professionelles, strukturiertes Besprechungsprotokoll.

ANTWORTE NUR MIT JSON:
{
  "titel": "Besprechungsprotokoll – [Betrifft]",
  "datum": "[Heutiges Datum]",
  "projekt": "[Projektnummer]",
  "adresse": "[Adresse]",
  "punkte": [
    {
      "nr": 1,
      "thema": "Kurzer Thementitel",
      "beschreibung": "Ausführliche Beschreibung des besprochenen Punkts",
      "massnahme": "Vereinbarte Maßnahme oder nächster Schritt (falls vorhanden)",
      "zustaendig": "Zuständige Person (falls genannt)",
      "ist_zusatzleistung": false
    }
  ],
  "zusammenfassung": "Kurze Gesamtzusammenfassung in 2-3 Sätzen",
  "offene_punkte": ["Punkt 1", "Punkt 2"]
}

REGELN:
- Fasse zusammengehörige Themen zu einem Punkt zusammen
- Erkenne ob ein Punkt eine ZUSATZLEISTUNG ist (nicht im Originalauftrag enthalten, Mehrarbeit, Änderungswunsch des Kunden) und setze ist_zusatzleistung auf true
- Formuliere professionell aber verständlich
- Alle Punkte nummerieren
- Ignoriere Smalltalk, Privatgespräche, Witze und irrelevante Nebenkommentare die nichts mit dem Bauprojekt zu tun haben
- Wenn mehrere Personen gleichzeitig sprechen und der Text durcheinander ist, versuche den Sinn zu erkennen und fasse die relevanten Punkte zusammen
- Konzentriere dich NUR auf bau-relevante Themen: Leistungen, Materialien, Termine, Zuständigkeiten, Mängel, Änderungswünsche, Zusatzleistungen
- Wenn unklar ist ob etwas relevant ist, nimm es als offenen Punkt in "offene_punkte" auf
- NUR JSON ausgeben`

export default function Protokoll({ embedded = false }) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Form
  const [projektnummer, setProjektnummer] = useState('')
  const [adresse, setAdresse] = useState('')
  const [betrifft, setBetrifft] = useState('')

  // Entries
  const [eintraege, setEintraege] = useState([])
  const [manualText, setManualText] = useState('')

  // Recording
  const [recordState, setRecordState] = useState('idle') // idle | recording | transcribing
  const [liveTranscript, setLiveTranscript] = useState('')
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const transcriptRef = useRef('')
  const isListeningRef = useRef(false)
  const addEntryRef = useRef(null)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [protokoll, setProtokoll] = useState(null)
  const [generateError, setGenerateError] = useState(null)

  // Media
  const [mediaFiles, setMediaFiles] = useState([])

  // Saving
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Email sending
  const [bauleiterList, setBauleiterList] = useState([])
  const [selectedBauleiter, setSelectedBauleiter] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentName, setSentName] = useState('')

  // Refs to read current field values inside callbacks (avoids stale closures)
  const projektnummerRef = useRef(projektnummer)
  const adresseRef = useRef(adresse)
  const betrifftRef = useRef(betrifft)
  useEffect(() => { projektnummerRef.current = projektnummer }, [projektnummer])
  useEffect(() => { adresseRef.current = adresse }, [adresse])
  useEffect(() => { betrifftRef.current = betrifft }, [betrifft])

  const autoFillDoneRef = useRef(false)
  const autoFillRunningRef = useRef(false)

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

  const AUTOFILL_SYSTEM = `Extrahiere aus dem folgenden Text die Projektnummer, Adresse und den Betreff.

REGELN FÜR ADRESSE:
- Die Adresse enthält IMMER die vollständige Angabe: Straße, Hausnummer, Top/Stiege/Hof
- 'Top 12' wird zu '/Top 12' (z.B. 'Klosterneuburger Straße 71/Top 12')
- 'Stiege 2 Top 5' wird zu '/Stiege 2/Top 5'
- 'Hof' oder 'im Hof' wird zu '/Hof'
- 'Erdgeschoss' oder 'EG' wird zu '/EG'
- 'Dachgeschoss' oder 'DG' wird zu '/DG'
- PLZ und Ort wenn genannt anhängen (z.B. 'Klosterneuburger Straße 71/Top 12, 1200 Wien')

ANTWORTE NUR MIT JSON:
{"projektnummer": "...", "adresse": "...", "betrifft": "..."}
Wenn ein Feld nicht erkennbar ist, setze es auf null.
NUR JSON, keine Erklärung.`

  function parseFieldsFromText(text) {
    let projektnummer = null, adresse = null, betrifft = null

    const pnMatch = text.match(/(?:projekt(?:nummer)?|projekt\s*(?:nr|nummer)?\.?)\s*:?\s*(\d[\d./\-]*)/i)
    if (pnMatch) projektnummer = pnMatch[1]

    const adrMatch = text.match(/adresse\s*:?\s*(.+?)(?:\.|,\s*betrifft|$)/i)
    if (adrMatch) adresse = adrMatch[1].trim()

    const betMatch = text.match(/betrifft\s*:?\s*(.+?)(?:\.|,\s*(?:nächste|erste|zweite|projekt|adresse)|$)/i)
    if (betMatch) betrifft = betMatch[1].trim()

    return { projektnummer, adresse, betrifft }
  }

  async function tryAutofillFields(text) {
    console.log('[AUTOFILL] ===== FUNKTION AUFGERUFEN =====', text)
    console.log('[AUTOFILL] Felder aktuell:', {
      projektnummer: projektnummerRef.current,
      adresse: adresseRef.current,
      betrifft: betrifftRef.current,
    })
    autoFillRunningRef.current = true

    try {
      // maxTokens klein halten – nur kurzes JSON erwartet
      const result = await callClaude(AUTOFILL_SYSTEM, text, null, 512)
      console.log('[AUTOFILL] API Ergebnis:', result)

      const data = parseJsonResponse(result)
      console.log('[AUTOFILL] Parsed:', data)

      if (!data) {
        console.log('[AUTOFILL] Kein JSON parsebar – markiere als done')
        autoFillDoneRef.current = true
        return
      }

      let filled = false
      if (data.projektnummer && !projektnummerRef.current) {
        setProjektnummer(String(data.projektnummer))
        projektnummerRef.current = String(data.projektnummer)
        filled = true
        console.log('[AUTOFILL] KI → Projektnummer:', data.projektnummer)
      }
      if (data.adresse && !adresseRef.current) {
        const normalizedAdresse = formatAdresse(String(data.adresse))
        setAdresse(normalizedAdresse)
        adresseRef.current = normalizedAdresse
        filled = true
        console.log('[AUTOFILL] KI → Adresse:', data.adresse)
      }
      if (data.betrifft && !betrifftRef.current) {
        setBetrifft(String(data.betrifft))
        betrifftRef.current = String(data.betrifft)
        filled = true
        console.log('[AUTOFILL] KI → Betrifft:', data.betrifft)
      }
      if (filled) showToast('Felder automatisch befüllt')

      // Stop retrying when all fields are filled OR the API had nothing for remaining empty fields
      const apiHadNothingForRemaining =
        (!projektnummerRef.current ? !data.projektnummer : true) &&
        (!adresseRef.current ? !data.adresse : true) &&
        (!betrifftRef.current ? !data.betrifft : true)
      if (apiHadNothingForRemaining) {
        console.log('[AUTOFILL] KI: keine weiteren Felder erkennbar – done')
        autoFillDoneRef.current = true
      }
    } catch (err) {
      console.error('[AUTOFILL] Fehler:', err.message, err)
      // don't mark as done on error – will retry on next entry
    } finally {
      autoFillRunningRef.current = false
    }
  }

  // Keep addEntry callback up to date in the ref (avoids stale closure in speech handlers)
  addEntryRef.current = (text) => {
    if (!text.trim()) return
    console.log('[AUTOFILL] addEntry aufgerufen:', text.slice(0, 60))

    const now = new Date()
    const time = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

    // Sofortiges Regex-Parsing – synchron, kein API-Call nötig
    if (!projektnummerRef.current || !adresseRef.current || !betrifftRef.current) {
      const parsed = parseFieldsFromText(text.trim())
      console.log('[AUTOFILL] Regex-Ergebnis:', parsed)
      if (parsed.projektnummer && !projektnummerRef.current) {
        setProjektnummer(parsed.projektnummer)
        projektnummerRef.current = parsed.projektnummer
        console.log('[AUTOFILL] Regex → Projektnummer:', parsed.projektnummer)
      }
      if (parsed.adresse && !adresseRef.current) {
        setAdresse(parsed.adresse)
        adresseRef.current = parsed.adresse
        console.log('[AUTOFILL] Regex → Adresse:', parsed.adresse)
      }
      if (parsed.betrifft && !betrifftRef.current) {
        setBetrifft(parsed.betrifft)
        betrifftRef.current = parsed.betrifft
        console.log('[AUTOFILL] Regex → Betrifft:', parsed.betrifft)
      }
    }

    const anyFieldEmpty = !projektnummerRef.current || !adresseRef.current || !betrifftRef.current
    console.log('[AUTOFILL] Nach Regex, anyFieldEmpty:', anyFieldEmpty, {
      done: autoFillDoneRef.current,
      running: autoFillRunningRef.current,
    })

    // KI-Autofill im Hintergrund – bessere Ergebnisse, überschreibt Regex-Werte falls besser
    if (!autoFillDoneRef.current && !autoFillRunningRef.current && anyFieldEmpty) {
      tryAutofillFields(text.trim())
    }

    setEintraege(prev => [...prev, {
      id: `${Date.now()}_${Math.random()}`,
      nr: prev.length + 1,
      text: text.trim(),
      time,
    }])
  }

  // Setup Web Speech API on mount
  useEffect(() => {
    if (USE_WHISPER) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'de-AT'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ').trim()
      transcriptRef.current = transcript
      setLiveTranscript(transcript)
    }
    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start() } catch {}
      } else {
        setRecordState('idle')
        const final = transcriptRef.current.trim()
        if (final) addEntryRef.current(final)
        transcriptRef.current = ''
        setLiveTranscript('')
      }
    }
    recognition.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      isListeningRef.current = false
      setRecordState('idle')
      setLiveTranscript('')
    }
    recognitionRef.current = recognition
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    if (USE_WHISPER) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        chunksRef.current = []
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        const recorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          setRecordState('transcribing')
          await transcribeWhisper(new Blob(chunksRef.current, { type: mimeType }), mimeType)
        }
        recorder.start()
        setRecordState('recording')
      } catch (err) {
        showToast(`Mikrofon: ${err.message}`, 'error')
      }
    } else {
      if (!recognitionRef.current) {
        showToast('Spracherkennung wird von diesem Browser nicht unterstützt', 'error')
        return
      }
      isListeningRef.current = true
      transcriptRef.current = ''
      setLiveTranscript('')
      setRecordState('recording')
      try { recognitionRef.current.start() } catch {}
    }
  }

  function stopRecording() {
    if (USE_WHISPER) {
      mediaRecorderRef.current?.stop()
    } else {
      isListeningRef.current = false
      recognitionRef.current?.stop()
    }
  }

  async function transcribeWhisper(blob, mimeType) {
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const formData = new FormData()
      formData.append('file', blob, `audio.${ext}`)
      formData.append('model', 'whisper-1')
      formData.append('language', 'de')
      formData.append('prompt', WHISPER_BAU_PROMPT)
      const headers = await getEdgeFunctionHeaders()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whisper-proxy`, {
        method: 'POST',
        headers,
        body: formData,
      })
      if (!res.ok) throw new Error('Whisper Fehler')
      const data = await res.json()
      if (data.text) addEntryRef.current(korrigiereTranskription(data.text.trim()))
    } catch (err) {
      showToast(`Transkription: ${err.message}`, 'error')
    } finally {
      setRecordState('idle')
    }
  }

  function handleMicClick() {
    if (recordState === 'recording') stopRecording()
    else if (recordState === 'idle') startRecording()
  }

  function removeEntry(id) {
    setEintraege(prev => {
      const filtered = prev.filter(e => e.id !== id)
      return filtered.map((e, i) => ({ ...e, nr: i + 1 }))
    })
  }

  function handleAddManual() {
    if (!manualText.trim()) return
    addEntryRef.current(manualText.trim())
    setManualText('')
  }

  function clearAll() {
    setEintraege([])
    setProtokoll(null)
    setGenerateError(null)
    setSavedId(null)
    setSent(false)
    setSentName('')
    setSelectedBauleiter('')
    setMediaFiles([])
    autoFillDoneRef.current = false
    autoFillRunningRef.current = false
  }

  async function handleSendBauleiter() {
    if (!savedId) return
    const bl = bauleiterList.find(b => b.id === selectedBauleiter) || {
      email: profile?.email || user?.email || '',
      name: profile?.name || user?.email || 'Unbekannt',
      isFallback: true,
    }
    setSending(true)
    try {
      const protokollLink = `${window.location.origin}/protokoll/${savedId}`
      let linkForEmail = protokollLink
      try {
        linkForEmail = await generateMagicLink(bl.email, protokollLink)
      } catch {
        linkForEmail = protokollLink
      }
      const htmlBody = buildProtokollHtml({
        betrifft,
        adresse,
        projektnummer,
        protokollData: protokoll,
        protokollLink: linkForEmail,
        erstelltVon: profile?.name || user?.email || '–',
      })
      const webhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL
      const payload = {
        empfaenger: bl.email,
        betreff: `Besprechungsprotokoll: ${betrifft || 'Protokoll'}`,
        angebotLink: linkForEmail,
        projektNummer: projektnummer || '–',
        adresse: adresse || '–',
        betrifft: betrifft || '–',
        gesamtsummeNetto: '',
        gesamtsummeBrutto: '',
        absenderName: profile?.name || user?.email || '–',
        absenderEmail: profile?.email || user?.email || '',
        htmlBody,
      }
      console.log('[Protokoll Mail] Webhook URL:', webhookUrl)
      console.log('[Protokoll Mail] Payload:', { ...payload, htmlBody: htmlBody?.slice(0, 100) + '...' })
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      console.log('[Protokoll Mail] Response:', res.status, res.statusText)
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

  async function handleGenerate() {
    if (eintraege.length === 0) return
    setGenerating(true)
    setGenerateError(null)
    setProtokoll(null)

    const today = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const userMessage = `Projektnummer: ${projektnummer || '–'}
Adresse: ${adresse || '–'}
Betrifft: ${betrifft || '–'}
Datum: ${today}

Gesprächsnotizen:
${eintraege.map(e => `[${e.time}] ${e.text}`).join('\n')}`

    try {
      const result = await callClaude(SYSTEM_PROMPT, userMessage)
      const data = parseJsonResponse(result)
      if (!data || !data.punkte) throw new Error('Ungültige Antwort von KI')
      setProtokoll(data)
    } catch (err) {
      setGenerateError(err.message)
      showToast('Fehler beim Erstellen des Protokolls', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!protokoll || !user) return
    setSaving(true)
    try {
      const saved = await saveProtokoll({
        userId: user.id,
        projektnummer,
        adresse,
        betrifft,
        eintraege,
        protokollData: protokoll,
      })
      if (mediaFiles.length > 0) {
        try {
          await uploadProtokollMedia(saved.id, mediaFiles)
        } catch (mediaErr) {
          console.error('Medien-Upload Fehler:', mediaErr)
          showToast('Protokoll gespeichert, aber Medien-Upload fehlgeschlagen.', 'error')
        }
      }
      setSavedId(saved.id)
      showToast('Protokoll gespeichert!')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function clearAll() {
    setProjektnummer('')
    setAdresse('')
    setBetrifft('')
    setEintraege([])
    setManualText('')
    setProtokoll(null)
    setGenerateError(null)
    setMediaFiles([])
    setSavedId(null)
    setSent(false)
    setSentName('')
    setShowResetConfirm(false)
    addEntryRef.current = null
  }

  const micSupported = USE_WHISPER ? !!navigator.mediaDevices : !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-4 space-y-4'}>
      {showResetConfirm && (
        <ConfirmDialog
          title="Neue Besprechung starten?"
          message="Alle Einträge und das aktuelle Protokoll werden gelöscht."
          confirmLabel="Ja, neu starten"
          onConfirm={clearAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="section-title">Neues Besprechungsprotokoll</h1>
        <div className="flex items-center gap-2">
          {(eintraege.length > 0 || protokoll) && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 text-xs text-gray-400 active:text-red-400 transition-colors px-2 py-1 rounded-lg"
            >
              <ArrowsClockwise size={13} weight="regular" />
              Neu
            </button>
          )}
          <Link to="/besprechung?tab=liste" className="text-sm text-primary font-medium">
            Alle →
          </Link>
        </div>
      </div>

      {/* Form Fields */}
      <div className="card space-y-3">
        <div>
          <label className="label block mb-1">Hero Projektnummer *</label>
          <input
            className="input-field"
            placeholder="z.B. 1234"
            value={projektnummer}
            onChange={e => setProjektnummer(e.target.value)}
          />
        </div>
        <div>
          <label className="label block mb-1">Adresse</label>
          <input
            className="input-field"
            placeholder="z.B. Musterstraße 5, 1010 Wien"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
          />
        </div>
        <div>
          <label className="label block mb-1">Betrifft</label>
          <input
            className="input-field"
            placeholder="z.B. Baubesprechung Rohbau"
            value={betrifft}
            onChange={e => setBetrifft(e.target.value)}
          />
        </div>
      </div>

      {/* Fotos & Videos */}
      {!savedId && (
        <MediaUpload files={mediaFiles} onChange={setMediaFiles} />
      )}

      {/* Recording & Entries */}
      {!savedId && (
        <div className="card space-y-4">
          <p className="text-sm font-semibold text-secondary">Einträge</p>

          {/* Big Mic Button */}
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              onClick={handleMicClick}
              disabled={!micSupported || recordState === 'transcribing'}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-md
                ${recordState === 'recording'
                  ? 'bg-red-500 text-white animate-pulse'
                  : recordState === 'transcribing'
                  ? 'bg-gray-300 text-gray-400 cursor-wait'
                  : 'bg-primary text-white active:bg-primary/80'}
                ${!micSupported ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              {recordState === 'transcribing'
                ? <SpinnerGap size={32} weight="bold" className="animate-spin" />
                : recordState === 'recording'
                ? <Stop size={32} weight="fill" />
                : <Microphone size={32} weight="fill" />
              }
            </button>
            <p className="text-xs text-gray-400">
              {!micSupported
                ? 'Mikrofon nicht verfügbar'
                : recordState === 'recording'
                ? 'Aufnahme läuft – tippe zum Stoppen'
                : recordState === 'transcribing'
                ? 'Wird transkribiert...'
                : 'Tippe zum Aufnehmen'
              }
            </p>
            {liveTranscript && (
              <p className="text-sm text-gray-500 text-center italic px-4 max-w-xs line-clamp-3">
                „{liveTranscript}"
              </p>
            )}
          </div>

          {/* Manual Input */}
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <input
              className="input-field flex-1 text-sm"
              placeholder="Oder manuell eingeben..."
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddManual()}
            />
            <button
              onClick={handleAddManual}
              disabled={!manualText.trim()}
              className="btn-secondary px-3 flex-shrink-0 disabled:opacity-40 flex items-center gap-1"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>

          {/* Entry List */}
          {eintraege.length > 0 && (
            <div className="space-y-2">
              {eintraege.map(e => (
                <div key={e.id} className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-bold text-primary w-5 flex-shrink-0 mt-0.5">•</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">{e.time}</p>
                    <p className="text-sm text-secondary leading-relaxed">{e.text}</p>
                  </div>
                  <button
                    onClick={() => removeEntry(e.id)}
                    className="text-gray-300 active:text-red-400 flex-shrink-0 mt-0.5"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {eintraege.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Noch keine Einträge. Spracheingabe oder manuellen Text hinzufügen.
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!savedId && (
        <div className="space-y-2">
          {generateError && (
            <div className="card bg-red-50 border border-red-200 text-red-600 text-sm py-3 px-4">
              {generateError}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={eintraege.length === 0 || generating}
            className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <SpinnerGap size={18} weight="bold" className="animate-spin" />
                Protokoll wird erstellt...
              </>
            ) : (
              <>
                <ClipboardText size={18} weight="fill" />
                Protokoll erstellen
              </>
            )}
          </button>
          {eintraege.length > 0 && !generating && (
            <button
              onClick={clearAll}
              className="btn-secondary w-full text-sm text-gray-500"
            >
              Einträge löschen
            </button>
          )}
        </div>
      )}

      {/* Generated Protocol Preview */}
      {protokoll && !savedId && (
        <div className="card space-y-4 border-t-4 border-t-primary">
          <ProtokollEditor protokoll={protokoll} onChange={setProtokoll} />
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <><SpinnerGap size={16} weight="bold" className="animate-spin" />Wird gespeichert...</>
                : <><CheckCircle size={16} weight="fill" />Protokoll speichern</>
              }
            </button>
            <button onClick={() => setProtokoll(null)} className="btn-secondary px-4 text-sm">
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {/* Saved State */}
      {savedId && (
        <div className="card space-y-3 border-t-4 border-t-green-600">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={20} weight="fill" />
            <span className="font-semibold">Protokoll gespeichert!</span>
          </div>
          <div className="flex gap-2">
            <Link to={`/protokoll/${savedId}`} className="btn-primary flex-1 text-center text-sm">
              Protokoll öffnen
            </Link>
            <Link to="/besprechung?tab=liste" className="btn-secondary flex-1 text-center text-sm">
              Alle Protokolle
            </Link>
          </div>

          {/* E-Mail versenden */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
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
                {!import.meta.env.VITE_MAKE_WEBHOOK_URL ? (
                  <p className="text-xs text-gray-400 text-center py-1">E-Mail-Versand nicht konfiguriert</p>
                ) : (
                  <button
                    onClick={handleSendBauleiter}
                    disabled={sending}
                    className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {sending
                      ? <><SpinnerGap size={15} weight="bold" className="animate-spin" />Wird gesendet...</>
                      : <><PaperPlaneTilt size={15} weight="fill" />{profile?.role === 'bauleiter' ? 'E-Mail an mich senden' : selectedBauleiter ? 'An Bauleiter senden' : 'E-Mail senden'}</>
                    }
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <Envelope size={15} weight="regular" className="flex-shrink-0" />
                <span className="text-sm">E-Mail wurde an {sentName} gesendet!</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              clearAll()
              setProjektnummer('')
              setAdresse('')
              setBetrifft('')
            }}
            className="text-xs text-gray-400 w-full text-center py-1"
          >
            Neues Protokoll erstellen
          </button>
        </div>
      )}
    </div>
  )
}

// Editable protocol component – used on create page and in ProtokollView
export function ProtokollEditor({ protokoll, onChange }) {
  const [editingNr, setEditingNr] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [newOffenerPunkt, setNewOffenerPunkt] = useState('')

  if (!protokoll) return null

  function startEdit(p) {
    setEditDraft({ ...p })
    setEditingNr(p.nr)
  }

  function cancelEdit() {
    setEditingNr(null)
    setEditDraft({})
  }

  function saveEdit() {
    if (editingNr === null) return
    const newPunkte = (protokoll.punkte || []).map(p => p.nr === editingNr ? { ...editDraft } : p)
    onChange({ ...protokoll, punkte: newPunkte })
    setEditingNr(null)
    setEditDraft({})
  }

  function deletePunkt(nr) {
    const newPunkte = (protokoll.punkte || [])
      .filter(p => p.nr !== nr)
      .map((p, i) => ({ ...p, nr: i + 1 }))
    onChange({ ...protokoll, punkte: newPunkte })
    if (editingNr === nr) { setEditingNr(null); setEditDraft({}) }
  }

  function addPunkt() {
    const punkte = protokoll.punkte || []
    const nextNr = punkte.length > 0 ? Math.max(...punkte.map(p => p.nr)) + 1 : 1
    const newP = { nr: nextNr, thema: '', beschreibung: '', massnahme: '', zustaendig: '', ist_zusatzleistung: false }
    const updated = { ...protokoll, punkte: [...punkte, newP] }
    onChange(updated)
    setEditDraft({ ...newP })
    setEditingNr(nextNr)
  }

  function toggleZusatzleistung(nr) {
    const newPunkte = (protokoll.punkte || []).map(p =>
      p.nr === nr ? { ...p, ist_zusatzleistung: !p.ist_zusatzleistung } : p
    )
    onChange({ ...protokoll, punkte: newPunkte })
    if (editingNr === nr) setEditDraft(d => ({ ...d, ist_zusatzleistung: !d.ist_zusatzleistung }))
  }

  function updateOffenerPunkt(idx, val) {
    const next = [...(protokoll.offene_punkte || [])]
    next[idx] = val
    onChange({ ...protokoll, offene_punkte: next })
  }

  function deleteOffenerPunkt(idx) {
    onChange({ ...protokoll, offene_punkte: (protokoll.offene_punkte || []).filter((_, i) => i !== idx) })
  }

  function addOffenerPunkt() {
    if (!newOffenerPunkt.trim()) return
    onChange({ ...protokoll, offene_punkte: [...(protokoll.offene_punkte || []), newOffenerPunkt.trim()] })
    setNewOffenerPunkt('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-bold text-secondary text-base leading-tight">{protokoll.titel}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {protokoll.datum && <span className="text-xs text-gray-500">📅 {protokoll.datum}</span>}
          {protokoll.projekt && <span className="text-xs text-gray-500">🔢 {protokoll.projekt}</span>}
          {protokoll.adresse && <span className="text-xs text-gray-500">📍 {protokoll.adresse}</span>}
        </div>
      </div>

      {/* Punkte */}
      <div className="space-y-3">
        {(protokoll.punkte || []).map(p => (
          <div key={p.nr} className={`rounded-xl border ${p.ist_zusatzleistung ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
            {editingNr === p.nr ? (
              <div className="p-3 space-y-2">
                <input
                  className="input-field text-sm py-1.5 font-semibold"
                  value={editDraft.thema || ''}
                  onChange={e => setEditDraft(d => ({ ...d, thema: e.target.value }))}
                  placeholder="Thema"
                  autoFocus
                />
                <textarea
                  className="input-field text-sm py-1.5 resize-none w-full"
                  rows={3}
                  value={editDraft.beschreibung || ''}
                  onChange={e => setEditDraft(d => ({ ...d, beschreibung: e.target.value }))}
                  placeholder="Beschreibung"
                />
                <input
                  className="input-field text-sm py-1.5"
                  value={editDraft.massnahme || ''}
                  onChange={e => setEditDraft(d => ({ ...d, massnahme: e.target.value }))}
                  placeholder="Maßnahme (optional)"
                />
                <input
                  className="input-field text-sm py-1.5"
                  value={editDraft.zustaendig || ''}
                  onChange={e => setEditDraft(d => ({ ...d, zustaendig: e.target.value }))}
                  placeholder="Zuständig (optional)"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!editDraft.ist_zusatzleistung}
                    onChange={e => setEditDraft(d => ({ ...d, ist_zusatzleistung: e.target.checked }))}
                    className="rounded accent-orange-500"
                  />
                  <span className="text-orange-700 font-medium">Zusatzleistung</span>
                </label>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveEdit} className="btn-primary flex-1 text-sm py-2">Speichern</button>
                  <button onClick={cancelEdit} className="btn-secondary text-sm py-2 px-4">Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-xs font-bold text-primary w-5 flex-shrink-0 mt-0.5">{p.nr}.</span>
                  <span className="font-semibold text-sm text-secondary flex-1 leading-snug">{p.thema}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleZusatzleistung(p.nr)}
                      title={p.ist_zusatzleistung ? 'Als normale Leistung markieren' : 'Als Zusatzleistung markieren'}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                        p.ist_zusatzleistung
                          ? 'bg-orange-100 text-orange-700 border-orange-200 active:bg-orange-200'
                          : 'bg-gray-100 text-gray-400 border-gray-200 active:border-orange-300 active:text-orange-500'
                      }`}
                    >
                      {p.ist_zusatzleistung ? 'Zusatz ✓' : '+ Zusatz'}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="text-gray-400 active:text-primary p-1 transition-colors"
                      title="Bearbeiten"
                    >
                      <PencilSimple size={14} weight="regular" />
                    </button>
                    <button
                      onClick={() => deletePunkt(p.nr)}
                      className="text-gray-300 active:text-red-500 p-1 transition-colors"
                      title="Löschen"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed ml-7">{p.beschreibung}</p>
                {p.massnahme && (
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    <span className="font-medium">Maßnahme:</span> {p.massnahme}
                  </p>
                )}
                {p.zustaendig && (
                  <p className="text-xs text-gray-400 mt-0.5 ml-7">
                    <span className="font-medium">Zuständig:</span> {p.zustaendig}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Punkt hinzufügen */}
        <button
          onClick={addPunkt}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium active:border-primary active:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={15} weight="bold" />
          Punkt hinzufügen
        </button>
      </div>

      {/* Zusammenfassung */}
      {protokoll.zusammenfassung !== undefined && (
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">Zusammenfassung</p>
          <textarea
            className="w-full bg-transparent text-sm text-blue-800 leading-relaxed resize-none outline-none border border-transparent focus:border-blue-300 rounded-lg p-1 transition-colors"
            rows={3}
            value={protokoll.zusammenfassung || ''}
            onChange={e => onChange({ ...protokoll, zusammenfassung: e.target.value })}
            placeholder="Zusammenfassung..."
          />
        </div>
      )}

      {/* Offene Punkte */}
      <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
        <p className="text-xs font-semibold text-yellow-700 mb-2">Offene Punkte</p>
        <div className="space-y-1.5">
          {(protokoll.offene_punkte || []).map((op, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-yellow-500 flex-shrink-0 text-sm">•</span>
              <input
                className="flex-1 bg-transparent text-sm text-yellow-800 outline-none border-b border-transparent focus:border-yellow-400 transition-colors py-0.5"
                value={op}
                onChange={e => updateOffenerPunkt(i, e.target.value)}
              />
              <button onClick={() => deleteOffenerPunkt(i)} className="text-yellow-400 active:text-red-500 flex-shrink-0">
                <X size={13} weight="bold" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 items-center mt-1">
            <span className="text-yellow-300 flex-shrink-0 text-sm">•</span>
            <input
              className="flex-1 bg-transparent text-sm text-yellow-700 outline-none border-b border-transparent focus:border-yellow-400 transition-colors py-0.5 placeholder:text-yellow-300"
              placeholder="Neuen offenen Punkt hinzufügen..."
              value={newOffenerPunkt}
              onChange={e => setNewOffenerPunkt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOffenerPunkt()}
            />
            {newOffenerPunkt.trim() && (
              <button onClick={addOffenerPunkt} className="text-yellow-600 text-sm font-bold px-1">+</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable protocol display component (read-only)
export function ProtokollDisplay({ protokoll }) {
  if (!protokoll) return null
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-secondary text-base leading-tight">{protokoll.titel}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {protokoll.datum && <span className="text-xs text-gray-500">📅 {protokoll.datum}</span>}
          {protokoll.projekt && <span className="text-xs text-gray-500">🔢 {protokoll.projekt}</span>}
          {protokoll.adresse && <span className="text-xs text-gray-500">📍 {protokoll.adresse}</span>}
        </div>
      </div>

      {/* Punkte */}
      <div className="space-y-3">
        {(protokoll.punkte || []).map(p => (
          <div key={p.nr} className={`rounded-xl p-3 border ${p.ist_zusatzleistung ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary w-5 flex-shrink-0">{p.nr}.</span>
              <span className="font-semibold text-sm text-secondary flex-1">{p.thema}</span>
              {p.ist_zusatzleistung && (
                <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
                  Zusatzleistung
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed ml-7">{p.beschreibung}</p>
            {p.massnahme && (
              <p className="text-xs text-gray-500 mt-1 ml-7">
                <span className="font-medium">Maßnahme:</span> {p.massnahme}
              </p>
            )}
            {p.zustaendig && (
              <p className="text-xs text-gray-400 mt-0.5 ml-7">
                <span className="font-medium">Zuständig:</span> {p.zustaendig}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Zusammenfassung */}
      {protokoll.zusammenfassung && (
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">Zusammenfassung</p>
          <p className="text-sm text-blue-800 leading-relaxed">{protokoll.zusammenfassung}</p>
        </div>
      )}

      {/* Offene Punkte */}
      {protokoll.offene_punkte?.length > 0 && (
        <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
          <p className="text-xs font-semibold text-yellow-700 mb-2">Offene Punkte</p>
          <ul className="space-y-1">
            {protokoll.offene_punkte.map((op, i) => (
              <li key={i} className="text-sm text-yellow-800 flex gap-2">
                <span className="text-yellow-500 flex-shrink-0">•</span>
                {op}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
