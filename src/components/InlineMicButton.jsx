import { useState, useRef, useEffect } from 'react'
import { Microphone, Stop, SpinnerGap } from '@phosphor-icons/react'
import { formatSpracheingabe, korrigiereTranskription, WHISPER_BAU_PROMPT } from '../utils/textFormat.js'
import { supabase, getEdgeFunctionHeaders } from '../lib/supabase.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_WHISPER = Boolean(SUPABASE_URL)

// Kompakter Mikrofon-Button für Inline-Bearbeitung (ohne Textarea/Submit)
export default function InlineMicButton({ onResult, onError, disabled = false, title = 'Bearbeiten' }) {
  const [state, setState] = useState('idle') // idle | recording | transcribing
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const recognitionRef = useRef(null)
  const isListeningRef = useRef(false)
  const [webSpeechSupported, setWebSpeechSupported] = useState(false)

  useEffect(() => {
    if (USE_WHISPER) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setWebSpeechSupported(true)
    const recognition = new SR()
    recognition.lang = 'de-AT'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript
      }
      if (text) { isListeningRef.current = false; onResult(formatSpracheingabe(korrigiereTranskription(text.trim()))) }
    }
    recognition.onend = () => {
      if (isListeningRef.current) { try { recognition.start() } catch {} }
      else setState('idle')
    }
    recognition.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return
      isListeningRef.current = false
      setState('idle')
      onError?.(`Sprachfehler: ${e.error}`)
    }
    recognitionRef.current = recognition
  }, [])

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
          setState('transcribing')
          await transcribeWhisper(new Blob(chunksRef.current, { type: mimeType }), mimeType)
        }
        recorder.start()
        setState('recording')
      } catch (err) {
        onError?.(`Mikrofon: ${err.message}`)
      }
    } else {
      if (!recognitionRef.current) return
      isListeningRef.current = true
      setState('recording')
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
      if (data.text) onResult(formatSpracheingabe(korrigiereTranskription(data.text.trim())))
    } catch (err) {
      onError?.(`Transkription: ${err.message}`)
    } finally {
      setState('idle')
    }
  }

  function handleClick(e) {
    e.stopPropagation()
    if (disabled || state === 'transcribing') return
    if (state === 'idle') startRecording()
    else stopRecording()
  }

  const supported = USE_WHISPER ? !!navigator.mediaDevices : webSpeechSupported

  return (
    <button
      onClick={handleClick}
      disabled={!supported || disabled || state === 'transcribing'}
      title={state === 'recording' ? 'Stoppen' : title}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0
        ${state === 'recording'
          ? 'bg-red-500 text-white pulse-mic shadow-sm'
          : state === 'transcribing'
          ? 'bg-gray-200 text-gray-400 cursor-wait'
          : 'bg-gray-100 text-gray-400 active:bg-primary/15 active:text-primary'}
        ${(!supported || disabled) ? 'opacity-30 cursor-not-allowed' : ''}
      `}
    >
      {state === 'transcribing'
        ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
        : state === 'recording'
        ? <Stop size={12} weight="fill" />
        : <Microphone size={14} weight="regular" />
      }
    </button>
  )
}
