import { useRef, useState } from 'react'
import { UploadSimple, Camera, VideoCamera, X, Image } from '@phosphor-icons/react'
import CameraCapture from './CameraCapture'

export default function MediaUpload({ files = [], onChange }) {
  const fileInputRef = useRef(null)

  // Custom camera state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState('photo') // 'photo' | 'video'

  function addFiles(fileList) {
    const added = Array.from(fileList).map(file => ({
      file,
      preview: file.type.startsWith('video/') ? null : URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
    }))
    onChange([...files, ...added])
  }

  function removeFile(idx) {
    const item = files[idx]
    if (item.preview) URL.revokeObjectURL(item.preview)
    onChange(files.filter((_, i) => i !== idx))
  }

  function handleDrop(e) {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  // Custom camera callbacks
  function openCamera(mode) {
    setCameraMode(mode)
    setCameraOpen(true)
  }

  function handleCameraCapture(capturedFiles) {
    addFiles(capturedFiles)
  }

  function handleCameraClose() {
    setCameraOpen(false)
  }

  const photos = files.filter(f => !f.isVideo)
  const videos = files.filter(f => f.isVideo)
  const photoCount = photos.length

  return (
    <>
      {/* Full-screen custom camera overlay */}
      {cameraOpen && (
        <CameraCapture
          mode={cameraMode}
          onCapture={handleCameraCapture}
          onClose={handleCameraClose}
        />
      )}

      <div className="card space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-secondary text-sm">Fotos / Videos</p>
          {photoCount > 0 && (
            <span className="text-xs font-medium text-green-600">✓ {photoCount} Foto{photoCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Drop zone – nur wenn noch keine Dateien */}
        {files.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-200 rounded-xl py-5 px-4 text-center space-y-1"
          >
            <Image size={26} weight="light" className="mx-auto text-gray-300" />
            <p className="text-sm text-gray-500">Fotos oder Videos hier ablegen</p>
            <p className="text-xs text-gray-400">oder über die Buttons unten aufnehmen</p>
          </div>
        )}

        {/* Fotos-Sektion */}
        {photos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Fotos ({photos.length})</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((item, i) => {
                const globalIdx = files.indexOf(item)
                return (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={item.preview}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <button
                      onClick={() => removeFile(globalIdx)}
                      className="absolute top-0 right-0 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center active:bg-black/80"
                    >
                      <X size={14} weight="bold" className="text-white" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Videos-Sektion */}
        {videos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Videos ({videos.length})</p>
            <div className="space-y-1">
              {videos.map((item, i) => {
                const globalIdx = files.indexOf(item)
                return (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-lg flex-shrink-0">🎥</span>
                    <span className="text-xs text-gray-600 flex-1 truncate">{item.file.name}</span>
                    <button
                      onClick={() => removeFile(globalIdx)}
                      className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 active:bg-gray-300"
                    >
                      <X size={14} weight="bold" className="text-gray-600" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 3 Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => openCamera('photo')}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors"
          >
            <Camera size={18} weight="regular" />
            <span className="text-xs leading-tight text-center">Fotos aufnehmen</span>
          </button>
          <button
            type="button"
            onClick={() => openCamera('video')}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors"
          >
            <VideoCamera size={18} weight="regular" />
            <span className="text-xs leading-tight text-center">Video aufnehmen</span>
          </button>
          <button
            type="button"
            onClick={() => { fileInputRef.current.value = ''; fileInputRef.current.click() }}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 active:bg-gray-50 transition-colors"
          >
            <UploadSimple size={18} weight="regular" />
            <span className="text-xs leading-tight text-center">Dateien hochladen</span>
          </button>
        </div>

        {/* Hidden input – nur noch für Dateiauswahl (kein capture mehr) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/*"
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>
    </>
  )
}
