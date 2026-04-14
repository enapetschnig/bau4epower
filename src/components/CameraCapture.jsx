import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, VideoCamera, X, Check, ArrowsClockwise } from '@phosphor-icons/react'

/**
 * Custom Camera Component – Burst-Foto-Modus & Video-Aufnahme
 *
 * Nutzt getUserMedia() statt <input capture> um auf iOS die
 * Einzel-Bestätigung pro Foto zu umgehen.
 *
 * Props:
 *   mode: 'photo' | 'video'
 *   onCapture(files: File[]) – Callback mit allen aufgenommenen Dateien
 *   onClose() – Kamera schließen
 */
export default function CameraCapture({ mode = 'photo', onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [photos, setPhotos] = useState([])       // { blob, url }
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [facingMode, setFacingMode] = useState('environment')
  const timerRef = useRef(null)

  // ─── Stream starten ────────────────────────────────────────
  const startStream = useCallback(async (facing) => {
    // Alten Stream stoppen
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }

    try {
      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: mode === 'video',
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setReady(true)
      setError(null)
    } catch (err) {
      console.error('Camera error:', err)
      setError(
        err.name === 'NotAllowedError'
          ? 'Kamera-Zugriff verweigert. Bitte in den Einstellungen erlauben.'
          : 'Kamera konnte nicht gestartet werden.'
      )
    }
  }, [mode])

  useEffect(() => {
    startStream(facingMode)
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Kamera wechseln ──────────────────────────────────────
  function toggleFacing() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startStream(next)
  }

  // ─── Foto aufnehmen (Burst) ───────────────────────────────
  function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        setPhotos(prev => [...prev, { blob, url }])
      },
      'image/jpeg',
      0.85
    )
  }

  // ─── Foto entfernen ───────────────────────────────────────
  function removePhoto(idx) {
    setPhotos(prev => {
      const item = prev[idx]
      if (item?.url) URL.revokeObjectURL(item.url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ─── Video-Aufnahme starten ───────────────────────────────
  function startRecording() {
    if (!streamRef.current) return

    chunksRef.current = []
    const options = { mimeType: 'video/mp4' }
    // Fallback für Browser die kein mp4 können
    let recorder
    try {
      recorder = new MediaRecorder(streamRef.current, options)
    } catch {
      try {
        recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' })
      } catch {
        recorder = new MediaRecorder(streamRef.current)
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'video/mp4'
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType })
      onCapture([file])
      onClose()
    }

    mediaRecorderRef.current = recorder
    recorder.start(500) // Chunk alle 500ms
    setRecording(true)
    setRecordTime(0)

    timerRef.current = setInterval(() => {
      setRecordTime(prev => prev + 1)
    }, 1000)
  }

  // ─── Video-Aufnahme stoppen ───────────────────────────────
  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  // ─── Fotos bestätigen ─────────────────────────────────────
  function confirmPhotos() {
    const fileList = photos.map((p, i) =>
      new File([p.blob], `foto_${Date.now()}_${i + 1}.jpg`, { type: 'image/jpeg' })
    )
    // URLs freigeben
    photos.forEach(p => { if (p.url) URL.revokeObjectURL(p.url) })
    onCapture(fileList)
    onClose()
  }

  // ─── Abbrechen ────────────────────────────────────────────
  function handleClose() {
    photos.forEach(p => { if (p.url) URL.revokeObjectURL(p.url) })
    if (recording) stopRecording()
    onClose()
  }

  // ─── Timer-Format ─────────────────────────────────────────
  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Error */}
      {error && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <p className="text-white text-lg">{error}</p>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-white text-black rounded-xl font-medium"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Video Viewfinder */}
      {!error && (
        <>
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X size={22} weight="bold" className="text-white" />
              </button>

              {mode === 'photo' && photos.length > 0 && (
                <div className="bg-primary text-white text-sm font-bold px-3 py-1.5 rounded-full">
                  {photos.length} Foto{photos.length !== 1 ? 's' : ''}
                </div>
              )}

              {mode === 'video' && recording && (
                <div className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                  {formatTime(recordTime)}
                </div>
              )}

              <button
                onClick={toggleFacing}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <ArrowsClockwise size={20} weight="bold" className="text-white" />
              </button>
            </div>

            {/* Photo thumbnails strip */}
            {mode === 'photo' && photos.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 border-white/40">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X size={10} weight="bold" className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="bg-black px-6 py-5 flex items-center justify-center gap-8 safe-area-bottom">
            {mode === 'photo' ? (
              <>
                {/* Shutter button */}
                <button
                  onClick={takePhoto}
                  disabled={!ready}
                  className="w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                >
                  <div className="w-[58px] h-[58px] rounded-full bg-white" />
                </button>

                {/* Confirm button – nur wenn Fotos da */}
                {photos.length > 0 && (
                  <button
                    onClick={confirmPhotos}
                    className="flex items-center gap-2 bg-green-500 text-white font-semibold px-5 py-3 rounded-full active:bg-green-600 transition-colors"
                  >
                    <Check size={20} weight="bold" />
                    Fertig ({photos.length})
                  </button>
                )}
              </>
            ) : (
              <>
                {!recording ? (
                  <button
                    onClick={startRecording}
                    disabled={!ready}
                    className="w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                  >
                    <div className="w-[58px] h-[58px] rounded-full bg-red-500" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="w-[72px] h-[72px] rounded-full border-[4px] border-red-500 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <div className="w-8 h-8 rounded-md bg-red-500" />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
