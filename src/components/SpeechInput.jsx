import { useState, useRef, useEffect } from 'react'
import { Microphone, Stop, SpinnerGap, Lightning } from '@phosphor-icons/react'
import { WHISPER_BAU_PROMPT, korrigiereTranskription } from '../utils/textFormat.js'
import { supabase, getEdgeFunctionHeaders, getFreshAccessToken } from '../lib/supabase.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const USE_WHISPER = Boolean(SUPABASE_URL)

// Primary split: "nächste Position"
const NAECHSTE_POSITION_RE = /n[aä]chste\s+position/gi

// Fallback signal words
const SIGNAL_WORDS_FALLBACK = /\b(nächster\s+punkt|nächstes|weiters|außerdem|zusätzlich|dann\s+noch|dann|und\s+dann)\b/gi

// Address detection – Hero-Format: "Straße Hausnr [Stiege X] [Top Y], PLZ Wien"
// ADRESSE_EXPLICIT_RE: captures after "Adresse" keyword using lazy match.
// Kommas sind ERLAUBT (Whisper: "Straße 5, Top 3, 1010 Wien").
// Stopp: Punkt+Großbuchstabe (Satzende), betrifft-Keyword, Zeilenende.
// Negative Lookbehind (?<!\d) verhindert Stopp bei "2. OG" oder "3. Stock".
const ADRESSE_EXPLICIT_RE = /(?:adresse|f[uü]r\s+die)[,:\s]+(?:ist\s+|sind\s+|lautet\s+)?(.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i
// ADRESSE_STREET_RE: matches "Straße Nr" patterns – komma-tolerant wie EXPLICIT_RE.
// Supports compound street names (Rennweg, Quellenstraße, Bösendorferstraße) via [\wäöüßÄÖÜ-]*
const ADRESSE_STREET_RE = /((?:[\wäöüßÄÖÜ-]+\s+){0,3}[\wäöüßÄÖÜ-]*(?:stra[sß]e|gasse|weg|platz|ring|allee|l[aä]nde|steig|zeile|hof|markt|br[uü]cke|promenade|ufer|damm|g[uü]rtel|boulevard)\s+\d+[a-z]?.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i

// Betrifft detection
const BETRIFFT_RE = /(?:betrifft|es\s+geht\s+um|geht\s+um)\s+(?:ist\s+|sind\s+|lautet\s+|:\s*)?([^,.!?\n]+)/i

// Projektnummer/Kunde detection – handles "Projektnummer", "Kunde", "Kundenname", "Projekt Nr.", "Hero Nr.", "P-Nr."
const PROJEKTNUMMER_RE = /(?:(?:hero\s+)?projekt(?:\s*nummer)?(?:\s*[-.\s]?nr\.?)?|p[-.\s]?nr\.?|hero\s+nr\.?|kunden?\s*name?|kunde)\s*:?\s*(?:ist|lautet|number|#|heißt)?\s*(.+?)(?:\.|,\s*(?:adresse|betrifft)|$)/im

// Phrases to ignore as bullet points
const IGNORE_BULLET_RE = /^ich\s+(brauche|möchte|hätte\s+gern|will)\s+ein\s+angebot|^ein\s+angebot\s+(für|bitte)|^angebot\s+für/i

// Apartment suffixes that always belong to the address (never to Positionen)
// Handles: Top X, Tür X, Stiege X [Top Y], OG X, EG, Keller, Stiegenhaus [und Hof], Hof
const WOHNUNGS_SUFFIX_RE = /^(stiege\s+\d+[a-z]?(?:\s+top\s+[\d+\-]+[a-z]?)?|top\s+[\d+\-]+[a-z]?|t[uü]r\s+\d+[a-z]?|[odeu]g\s+\d*|keller|stiegenhaus(?:\s+und\s+hof)?|hof)/i

/**
 * Extracts 4 fields from raw speech transcript.
 * Used when enableBullets=true and recording stops.
 */
function extractFields(text) {
  if (!text.trim()) return { projektnummer: '', adresse: '', betrifft: '', positionen: '' }

  let remaining = text

  let projektnummer = ''
  const pnrMatch = remaining.match(PROJEKTNUMMER_RE)
  if (pnrMatch) {
    projektnummer = pnrMatch[1].replace(/[.,!?]+$/, '').trim()
    remaining = remaining.replace(pnrMatch[0], ' ').trim()
  }

  let adresse = ''
  const adresseMatch = remaining.match(ADRESSE_EXPLICIT_RE) || remaining.match(ADRESSE_STREET_RE)
  if (adresseMatch) {
    let adresseRaw = (adresseMatch[1] || adresseMatch[0]).replace(/[,.\s]+$/, '').trim()
    // Safety: Falls betrifft-Keyword durchrutscht, abschneiden
    const keywordCut = adresseRaw.match(/\s+((?:betrifft|es\s+geht\s+um|geht\s+um)\b.*)$/i)
    if (keywordCut) {
      adresseRaw = adresseRaw.slice(0, keywordCut.index).trim()
    }
    // PLZ-Trim: Alles nach PLZ+Ort abschneiden (verhindert Über-Erfassung)
    const plzOrtTrim = adresseRaw.match(/^(.*?\d{4}\s+[\wÄÖÜäöü]+)\s*[,.]?\s*(.+)/)
    if (plzOrtTrim && plzOrtTrim[2] && !/^(?:top|stiege|t[uü]r|stock|og|eg|dg|ug|keller|hof)\b/i.test(plzOrtTrim[2])) {
      adresseRaw = plzOrtTrim[1].trim()
      remaining = plzOrtTrim[2].trim() + (remaining ? ' ' + remaining : '')
    }
    adresse = adresseRaw
    remaining = remaining.replace(adresseMatch[0], ' ').trim()
    // Den abgeschnittenen Teil (z.B. "betrifft Malerarbeiten ...") zurück in remaining
    if (keywordCut) {
      remaining = keywordCut[1].trim() + (remaining ? ' ' + remaining : '')
    }
    // Clean up: remove orphaned "Adresse" keyword
    remaining = remaining.replace(/^[\s,.:;]*\b(?:adresse|die\s+adresse)\b[\s,.:;]*/i, '').trim()
    // Append any apartment suffix that wasn't captured (safety net)
    const remainingForWohnung = remaining.replace(/^[\s,.:;]+/, '')
    const wohnungsMatch = remainingForWohnung.match(WOHNUNGS_SUFFIX_RE)
    if (wohnungsMatch) {
      adresse = adresse + ' ' + wohnungsMatch[0].trim()
      remaining = remainingForWohnung.slice(wohnungsMatch[0].length).trim()
    }
    // If no PLZ yet, try to pick up trailing "XXXX Wien" / "XXXX Ort"
    if (!/\d{4}/.test(adresse)) {
      const plzClean = remaining.replace(/^[\s,.:;]+/, '')
      const plzMatch = plzClean.match(/^(\d{4})\s+([\wÄÖÜäöü]+)/)
      if (plzMatch) {
        adresse += `, ${plzMatch[1]} ${plzMatch[2]}`
        remaining = plzClean.slice(plzMatch[0].length).trim()
      }
    }
  }

  let betrifft = ''
  const betrifftMatch = remaining.match(BETRIFFT_RE)
  if (betrifftMatch) {
    betrifft = betrifftMatch[1].replace(/[,.\s]+$/, '').trim()
    remaining = remaining.replace(betrifftMatch[0], ' ').trim()
  }

  remaining = remaining.replace(/^\s*[,.:;!?]+\s*/, '').trim()

  function cleanPart(s) {
    return s.trim().replace(/^[,.:;!?\s]+/, '').replace(/[.!?,;]+$/, '').trim()
  }

  const primaryParts = remaining.split(NAECHSTE_POSITION_RE)
  let bullets
  if (primaryParts.length > 1) {
    bullets = primaryParts.map(cleanPart).filter(s => s.length > 2).filter(s => !IGNORE_BULLET_RE.test(s)).filter(s => !PROJEKTNUMMER_RE.test(s)).filter(s => !WOHNUNGS_SUFFIX_RE.test(s))
  } else {
    const normalised = remaining.replace(SIGNAL_WORDS_FALLBACK, '\x00')
    const fallbackParts = normalised.split(/[.!?]+\s+|\x00/)
    bullets = fallbackParts.map(cleanPart).filter(s => s.length > 2).filter(s => !IGNORE_BULLET_RE.test(s)).filter(s => !PROJEKTNUMMER_RE.test(s)).filter(s => !WOHNUNGS_SUFFIX_RE.test(s))
    if (bullets.length === 0 && remaining.trim().length > 2) bullets = [remaining.trim()]
  }

  return {
    projektnummer,
    adresse,
    betrifft,
    positionen: bullets.map(b => `• ${b}`).join('\n'),
  }
}

/**
 * Parses an already-formatted template text into the 4 fields.
 * Robust: Alles was NICHT Projektnummer/Adresse/Betrifft ist, gilt als Positionen.
 */
function parseTemplateToFields(text) {
  if (!text.trim()) return { projektnummer: '', adresse: '', betrifft: '', positionen: '' }

  const pnrLineMatch = text.match(/^(?:Projektnummer|Kunde):\s*(.+)$/m)
  const pnrRawMatch = !pnrLineMatch ? text.match(PROJEKTNUMMER_RE) : null
  const adresseMatch = text.match(/^Adresse:\s*(.+)$/m)
  const betrifftMatch = text.match(/^Betrifft:\s*(.+)$/m)

  // Alle Meta-Zeilen entfernen → Rest = Positionen
  const metaPatterns = [
    /^(?:Projektnummer|Kunde):\s*.+$/m,
    /^Adresse:\s*.+$/m,
    /^Betrifft:\s*.+$/m,
  ]
  let remaining = text
  for (const pat of metaPatterns) {
    remaining = remaining.replace(pat, '')
  }
  // Wenn keine "Label:"-Zeilen, aber PROJEKTNUMMER_RE matched, auch entfernen
  if (!pnrLineMatch && pnrRawMatch) {
    remaining = remaining.replace(pnrRawMatch[0], '')
  }
  // Leere Zeilen am Anfang/Ende entfernen, aber interne Struktur beibehalten
  const positionen = remaining.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')

  return {
    projektnummer: pnrLineMatch ? pnrLineMatch[1].trim() : (pnrRawMatch ? pnrRawMatch[1].replace(/[.,!?]+$/, '').trim() : ''),
    adresse: adresseMatch ? adresseMatch[1].trim() : '',
    betrifft: betrifftMatch ? betrifftMatch[1].trim() : '',
    positionen,
  }
}

/**
 * Assembles the 4 fields into a single API-ready text string.
 */
function assembleText(projektnummer, adresse, betrifft, positionen, projektnummerFieldLabel) {
  const lines = []
  const fieldName = projektnummerFieldLabel || 'Projektnummer'
  if (projektnummer.trim()) lines.push(`${fieldName}: ${projektnummer.trim()}`)
  if (adresse.trim()) lines.push(`Adresse: ${adresse.trim()}`)
  if (betrifft.trim()) lines.push(`Betrifft: ${betrifft.trim()}`)
  if (lines.length > 0 && positionen.trim()) lines.push('')
  if (positionen.trim()) lines.push(positionen.trim())
  return lines.join('\n')
}

export default function SpeechInput({
  onResult,
  onError,
  placeholder = 'Was soll kalkuliert werden?',
  submitLabel = 'Kalkulieren',
  autoStart = false,
  showPositionTipp = false,
  showGrossTipp = false,
  enableBullets = true,
  projektnummerLabel,
  positionenLabel,
  positionenPlaceholder,
  initialValue,
  labelAction,
  bottomSlot,
  onTextChange,
  onEnrichAdresse,
  disabled = false,
  formatTranscript = (t) => t,
}) {
  // ── Shared recording state ────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  // ── enableBullets=false: single transcript ────────────────
  const [transcript, setTranscript] = useState('')

  // ── enableBullets=true: 4 separate fields ────────────────
  const [projektnummer, setProjektnummer] = useState('')
  const [adresse, setAdresse] = useState('')
  const [isEnrichingAdresse, setIsEnrichingAdresse] = useState(false)
  const [betrifft, setBetrifft] = useState('')
  const [positionen, setPositionen] = useState('')

  // Accumulated raw text during recording (not state, to avoid re-renders)
  const rawTranscriptRef = useRef('')

  // Refs for recording infrastructure
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const isListeningRef = useRef(false)
  const wakeLockRef = useRef(null)
  const [webSpeechSupported, setWebSpeechSupported] = useState(false)

  // Textarea refs for auto-resize
  const transcriptRef = useRef(null)
  const positionenRef = useRef(null)

  const toggleRecordingRef = useRef(null)

  // ── Notify parent of content changes ─────────────────────
  useEffect(() => {
    if (enableBullets) {
      onTextChange?.(assembleText(projektnummer, adresse, betrifft, positionen, projektnummerLabel))
    } else {
      onTextChange?.(transcript)
    }
  }, [transcript, projektnummer, adresse, betrifft, positionen])

  // ── Inject from initialValue (template load) ─────────────
  useEffect(() => {
    if (initialValue === undefined || initialValue === null) return
    if (enableBullets) {
      const fields = parseTemplateToFields(initialValue)
      setProjektnummer(fields.projektnummer)
      setAdresse(fields.adresse)
      setBetrifft(fields.betrifft)
      setPositionen(fields.positionen)
    } else {
      setTranscript(initialValue)
    }
  }, [initialValue])

  // ── Auto-resize textareas ─────────────────────────────────
  useEffect(() => {
    const el = transcriptRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(120, el.scrollHeight) + 'px'
  }, [transcript])

  useEffect(() => {
    const el = positionenRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(120, el.scrollHeight) + 'px'
  }, [positionen])

  // ── Fill fields when recording stops ─────────────────────
  const prevRecording = useRef(false)
  useEffect(() => {
    if (prevRecording.current && !isRecording && rawTranscriptRef.current) {
      const raw = rawTranscriptRef.current
      rawTranscriptRef.current = ''
      if (enableBullets) {
        const fields = extractFields(korrigiereTranskription(raw))
        if (fields.projektnummer) setProjektnummer(fields.projektnummer)
        if (fields.adresse) {
          if (onEnrichAdresse) {
            setAdresse('')
            setIsEnrichingAdresse(true)
            onEnrichAdresse(fields.adresse).then(enriched => {
              setAdresse(enriched || fields.adresse)
              setIsEnrichingAdresse(false)
            }).catch(() => {
              setAdresse(fields.adresse)
              setIsEnrichingAdresse(false)
            })
          } else {
            setAdresse(fields.adresse)
          }
        }
        if (fields.betrifft) setBetrifft(fields.betrifft)
        if (fields.positionen) setPositionen(prev => prev.trim() ? prev + '\n' + fields.positionen : fields.positionen)
      } else {
        setTranscript(formatTranscript(korrigiereTranskription(raw)))
      }
    }
    prevRecording.current = isRecording
  }, [isRecording])

  // ── Wake Lock: Bildschirm wach halten während Aufnahme ───
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        console.log('[WakeLock] Bildschirm bleibt wach')
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[WakeLock] Freigegeben')
        })
      }
    } catch (err) {
      console.warn('[WakeLock] Nicht verfügbar:', err.message)
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }

  // Wake Lock bei Tab-Wechsel erneut anfordern (iOS gibt ihn sonst frei)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && isRecording) {
        await requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isRecording])

  // ── Web Speech API setup ──────────────────────────────────
  useEffect(() => {
    if (USE_WHISPER) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    setWebSpeechSupported(true)
    const recognition = new SpeechRecognition()
    recognition.lang = 'de-AT'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript
      }
      rawTranscriptRef.current = finalText
    }
    recognition.onend = () => {
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) {
            try { recognition.start() } catch {}
          }
        }, 150)
      } else {
        setIsRecording(false)
      }
    }
    recognition.onerror = (event) => {
      // 'aborted', 'no-speech', 'network' are non-fatal – onend will restart if needed
      if (event.error === 'aborted' || event.error === 'no-speech' || event.error === 'network') return
      isListeningRef.current = false
      setIsRecording(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onError?.('Mikrofon-Berechtigung fehlt – bitte in den Browser-Einstellungen erlauben')
      } else {
        onError?.(`Sprachfehler: ${event.error}`)
      }
    }
    recognitionRef.current = recognition
  }, [])

  // ── Whisper ───────────────────────────────────────────────
  async function startWhisperRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // iOS Safari: audio/webm NOT supported, audio/mp4 may also fail
      // → Try webm, then mp4, then let browser choose default
      let recorder
      const tryMime = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/wav']
      let usedMime = ''
      for (const mime of tryMime) {
        if (MediaRecorder.isTypeSupported(mime)) {
          usedMime = mime
          break
        }
      }
      try {
        recorder = usedMime
          ? new MediaRecorder(stream, { mimeType: usedMime })
          : new MediaRecorder(stream) // fallback: no mimeType → browser default
      } catch {
        // If explicit mimeType fails (some iOS versions), try without
        recorder = new MediaRecorder(stream)
        usedMime = ''
      }
      // Read actual mimeType the recorder is using
      const actualMime = recorder.mimeType || usedMime || 'audio/mp4'
      console.log('[Whisper] MediaRecorder mimeType:', actualMime, '| requested:', usedMime || '(default)')

      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: actualMime })
        console.log('[Whisper] Audio blob:', blob.size, 'bytes, type:', blob.type)
        if (blob.size < 100) {
          onError?.('Aufnahme zu kurz – bitte nochmal versuchen')
          setIsTranscribing(false)
          return
        }
        await transcribeWithWhisper(blob, actualMime)
      }
      // iOS Safari: use timeslice to ensure ondataavailable fires reliably
      recorder.start(1000)
      setIsRecording(true)
      await requestWakeLock()
    } catch (err) {
      console.error('[Whisper] startRecording error:', err)
      onError?.(`Mikrofon: ${err.message}`)
    }
  }

  function stopWhisperRecording() {
    setIsRecording(false)
    setIsTranscribing(true)
    releaseWakeLock()
    mediaRecorderRef.current?.stop()
  }

  // Helper: build FormData for Whisper upload
  function buildWhisperFormData(blob, mimeType) {
    // Map MIME type to file extension Whisper understands
    // Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
    let ext = 'webm'
    if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) ext = 'mp4'
    else if (mimeType.includes('wav')) ext = 'wav'
    else if (mimeType.includes('ogg') || mimeType.includes('oga')) ext = 'ogg'
    else if (mimeType.includes('webm')) ext = 'webm'
    // Safari sometimes reports empty or 'audio' without subtype
    else if (!mimeType || mimeType === 'audio' || mimeType === '') ext = 'mp4'

    const fileName = `audio.${ext}`
    // iOS Safari: File object works better than Blob in FormData
    const file = new File([blob], fileName, { type: mimeType || `audio/${ext}` })
    const formData = new FormData()
    formData.append('file', file, fileName)
    formData.append('model', 'whisper-1')
    formData.append('language', 'de')
    formData.append('prompt', WHISPER_BAU_PROMPT)
    return { formData, ext }
  }

  // Helper: upload via XMLHttpRequest (fallback for iOS Safari where fetch fails)
  function xhrUpload(url, formData, headers) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) }
          catch { reject(new Error('Ungültige Server-Antwort')) }
        } else {
          let errMsg = 'Whisper API Fehler'
          try { errMsg = JSON.parse(xhr.responseText)?.error?.message || errMsg } catch {}
          reject(new Error(errMsg))
        }
      }
      xhr.onerror = () => reject(new Error('Netzwerkfehler – bitte Verbindung prüfen'))
      xhr.ontimeout = () => reject(new Error('Zeitüberschreitung – bitte nochmal versuchen'))
      xhr.timeout = 60000
      xhr.send(formData)
    })
  }

  async function transcribeWithWhisper(blob, mimeType) {
    try {
      const { formData, ext } = buildWhisperFormData(blob, mimeType)
      console.log('[Whisper] Sending as:', `audio.${ext}`, '| blob type:', blob.type, '| size:', blob.size)

      const userToken = await getFreshAccessToken()

      const url = '/api/whisper-proxy'
      let data

      // Try fetch first, fall back to XMLHttpRequest (iOS Safari fix)
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'x-user-token': userToken },
          body: formData,
        })
        if (!response.ok) {
          const errText = await response.text()
          console.error('[Whisper] API error:', response.status, errText)
          let errMsg = 'Whisper API Fehler'
          try { errMsg = JSON.parse(errText)?.error?.message || errMsg } catch {}
          throw new Error(errMsg)
        }
        data = await response.json()
      } catch (fetchErr) {
        // iOS Safari: fetch() with FormData+Blob fails with "Load failed"
        // → Retry with XMLHttpRequest as fallback
        const isLoadFailed = /load|failed|fehlt|netzwerk/i.test(fetchErr.message)
        if (isLoadFailed) {
          console.warn('[Whisper] fetch failed (iOS?), retrying with XHR:', fetchErr.message)
          const { formData: retryFormData } = buildWhisperFormData(blob, mimeType)
          data = await xhrUpload(url, retryFormData, { 'x-user-token': userToken })
        } else {
          throw fetchErr
        }
      }
      console.log('=== WHISPER RESULT ===', data.text)
      console.log('=== korrigiereTranskription vorhanden? ===', typeof korrigiereTranskription)
      console.log('=== formatTranscript vorhanden? ===', typeof formatTranscript)
      if (enableBullets) {
        const fields = extractFields(korrigiereTranskription(data.text))
        if (fields.projektnummer) setProjektnummer(fields.projektnummer)
        if (fields.adresse) {
          if (onEnrichAdresse) {
            // Ladezeichen anzeigen, NICHT die rohe Adresse
            setAdresse('')
            setIsEnrichingAdresse(true)
            onEnrichAdresse(fields.adresse).then(enriched => {
              setAdresse(enriched || fields.adresse)
              setIsEnrichingAdresse(false)
            }).catch(() => {
              setAdresse(fields.adresse)
              setIsEnrichingAdresse(false)
            })
          } else {
            setAdresse(fields.adresse)
          }
        }
        if (fields.betrifft) setBetrifft(fields.betrifft)
        if (fields.positionen) setPositionen(prev => prev.trim() ? prev + '\n' + fields.positionen : fields.positionen)
      } else {
        const korrigiert = korrigiereTranskription(data.text)
        const formatiert = formatTranscript(korrigiert)
        console.log('FORMATIERT:', formatiert.substring(0, 120))
        setTranscript(formatiert)
      }
    } catch (err) {
      onError?.(`Transkription fehlgeschlagen: ${err.message}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  // ── Toggle recording ──────────────────────────────────────
  function toggleRecording() {
    if (USE_WHISPER) {
      if (isRecording) { stopWhisperRecording() }
      else { rawTranscriptRef.current = ''; startWhisperRecording() }
    } else {
      if (!recognitionRef.current) return
      if (isRecording) {
        isListeningRef.current = false
        recognitionRef.current.stop()
        releaseWakeLock()
      } else {
        rawTranscriptRef.current = ''
        isListeningRef.current = true
        setIsRecording(true)
        requestWakeLock()
        try { recognitionRef.current.start() } catch {}
      }
    }
  }

  toggleRecordingRef.current = toggleRecording

  useEffect(() => {
    if (!autoStart) return
    const timer = setTimeout(() => toggleRecordingRef.current?.(), 300)
    return () => clearTimeout(timer)
  }, [])

  // ── Submit ────────────────────────────────────────────────
  function handleSubmit() {
    const text = enableBullets
      ? assembleText(projektnummer, adresse, betrifft, positionen, projektnummerLabel).trim()
      : transcript.trim()
    if (!text) return
    onResult(text)
  }

  const supported = USE_WHISPER ? !!navigator.mediaDevices : webSpeechSupported
  const busy = isTranscribing
  const hasContent = enableBullets
    ? assembleText(projektnummer, adresse, betrifft, positionen, projektnummerLabel).trim().length > 0
    : transcript.trim().length > 0

  return (
    <div className="card space-y-3">
      {/* ── Mic Button ── */}
      <div className="flex flex-col items-center gap-2 py-2">
        <button
          onClick={toggleRecording}
          disabled={!supported || isTranscribing || disabled}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200
            ${isRecording
              ? 'bg-primary text-white pulse-mic scale-105'
              : 'bg-primary text-white shadow-md active:scale-95'
            }
            ${(!supported || isTranscribing) ? 'opacity-40 cursor-not-allowed' : ''}
          `}
        >
          {isTranscribing
            ? <SpinnerGap size={28} weight="bold" className="animate-spin" />
            : isRecording
            ? <Stop size={24} weight="fill" />
            : <Microphone size={28} weight="regular" />
          }
        </button>
        <p className="text-[12px] text-gray-400 text-center">
          {!supported ? 'Spracheingabe nicht verfügbar' :
           isTranscribing ? 'Wird transkribiert...' :
           isRecording ? 'Aufnahme läuft – Stop drücken' :
           'Mikrofon drücken zum Sprechen'}
        </p>
        {showPositionTipp && !isTranscribing && enableBullets && (
          <p className="text-[11px] text-gray-400 text-center leading-relaxed px-2">
            Sag <strong className="text-gray-500">"Kunde"</strong>, <strong className="text-gray-500">"Adresse"</strong>, <strong className="text-gray-500">"Betrifft"</strong> – Felder füllen sich automatisch.
            Trennwort: <strong className="text-gray-500">"nächste Position"</strong>
          </p>
        )}
        {showGrossTipp && !isTranscribing && (
          <p className="text-[11px] text-gray-400 text-center leading-relaxed px-2">
            Gewerk einzeln ansagen, z.B. <strong className="text-gray-500">"Gewerk Installateur: WC montieren, Waschtisch anschließen"</strong>.
            Trennwort: <strong className="text-gray-500">"nächste Position"</strong>
          </p>
        )}
      </div>

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <label className="label">Eingabe</label>
        {labelAction}
      </div>

      {enableBullets ? (
        /* ── New: 4-field layout ── */
        <div className="space-y-2">
          <div>
            <label className="label block mb-0.5">{projektnummerLabel || 'Projektnummer'}</label>
            <input
              className="input-field"
              value={projektnummer}
              onChange={e => setProjektnummer(e.target.value)}
              placeholder={projektnummerLabel === 'Kunde' ? 'z.B. Familie Müller' : 'z.B. 100'}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="label block mb-1">
              Adresse
              {isEnrichingAdresse && (
                <span className="ml-2 text-xs text-gray-400 font-normal inline-flex items-center gap-1">
                  <SpinnerGap size={12} weight="bold" className="animate-spin" />
                  Adresse wird geprüft…
                </span>
              )}
            </label>
            <input
              className={`input-field ${isEnrichingAdresse ? 'animate-pulse bg-gray-50' : ''}`}
              value={adresse}
              onChange={e => setAdresse(e.target.value)}
              placeholder={isEnrichingAdresse ? 'Wird gesucht…' : 'z.B. Klosterneuburger Straße 81 Top 12, 1200 Wien'}
              disabled={disabled || isEnrichingAdresse}
            />
          </div>
          <div>
            <label className="label block mb-1">Betrifft</label>
            <input
              className="input-field"
              value={betrifft}
              onChange={e => setBetrifft(e.target.value)}
              placeholder="z.B. Malerarbeiten Wohnung"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="label block mb-1">{positionenLabel || 'Positionen'}</label>
            <textarea
              ref={positionenRef}
              className="input-field resize-none overflow-hidden"
              style={{ minHeight: '120px' }}
              value={positionen}
              onChange={e => setPositionen(e.target.value)}
              placeholder={positionenPlaceholder || '• Boden abdecken im Schlafzimmer 20m²\n• Wände und Decken abscheren 5×4×3,5m\n• ...'}
              disabled={disabled}
            />
          </div>
        </div>
      ) : (
        /* ── Old: single textarea (enableBullets=false) ── */
        <textarea
          ref={transcriptRef}
          className="input-field resize-none overflow-hidden"
          style={{ minHeight: '120px' }}
          placeholder={placeholder}
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          disabled={disabled}
        />
      )}

      {/* ── Kalkulieren button ── */}
      <div className="flex">
        <button
          onClick={handleSubmit}
          className="btn-primary w-full"
          disabled={!hasContent || busy || isRecording || isEnrichingAdresse || disabled}
        >
          <Lightning size={16} weight="fill" />
          {submitLabel}
        </button>
      </div>

      {bottomSlot}
    </div>
  )
}
