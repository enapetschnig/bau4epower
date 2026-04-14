import { supabase } from './supabase.js'

const BUCKET = 'offer-media'
const isDev = import.meta.env.DEV

/**
 * Lädt alle Mediendateien für ein Angebot hoch und speichert URLs in offer_media.
 * files = Array von { file: File, isVideo: boolean }
 */
export async function uploadOfferMedia(offerId, files, onProgress) {
  isDev && console.log('Starte Medien-Upload für offer_id:', offerId, '| Anzahl Dateien:', files.length)

  const results = []
  const totalBytes = files.reduce((sum, item) => sum + (item.file?.size || 0), 0)
  let uploadedBytes = 0

  for (let i = 0; i < files.length; i++) {
    const item = files[i]
    const file = item.file
    isDev && console.log(`Upload Datei ${i + 1}/${files.length}:`, file?.name, file?.size, 'bytes', '| type:', file?.type, '| isVideo:', item.isVideo)

    if (!file) {
      console.error('Datei-Objekt fehlt bei Index', i, item)
      continue
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = `${offerId}/${safeName}`
    isDev && console.log('Storage Pfad:', storagePath)

    if (onProgress) {
      onProgress({
        percent: totalBytes > 0 ? Math.round(uploadedBytes / totalBytes * 100) : 0,
        current: i + 1,
        total: files.length,
        isVideo: item.isVideo,
      })
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true })
    isDev && console.log('Upload Ergebnis:', uploadData, uploadError)
    if (uploadError) {
      console.error('Storage Upload Fehler:', uploadError.message, uploadError)
      throw uploadError
    }

    const { data: dbData, error: dbError } = await supabase
      .from('offer_media')
      .insert({
        offer_id: offerId,
        file_name: file.name,
        file_url: storagePath,
        file_type: file.type || (item.isVideo ? 'video/mp4' : 'image/jpeg'),
        file_size: file.size,
      })
      .select()
    isDev && console.log('DB Insert Ergebnis:', dbData, dbError)
    if (dbError) {
      console.error('DB Insert Fehler:', dbError.message, dbError)
      throw dbError
    }

    uploadedBytes += file.size || 0
    results.push({ path: storagePath, name: file.name, type: file.type })
  }

  if (onProgress) {
    onProgress({ percent: 100, current: files.length, total: files.length, done: true })
  }

  isDev && console.log('Medien-Upload abgeschlossen:', results.length, 'Dateien hochgeladen')
  return results
}

/**
 * Löscht alle Medien eines Angebots aus Storage und offer_media Tabelle.
 * Reihenfolge: Storage-Dateien → offer_media Einträge → (offers wird vom Aufrufer gelöscht)
 */
export async function deleteOfferMedia(offerId) {
  const { data: mediaFiles } = await supabase
    .from('offer_media')
    .select('*')
    .eq('offer_id', offerId)

  if (mediaFiles && mediaFiles.length > 0) {
    // file_url ist gespeichert als "offerId/filename" – direkt als Storage-Pfad verwenden
    const filePaths = mediaFiles.map(m => {
      // Falls die URL versehentlich den vollen Pfad mit Bucket-Name enthält, kürzen
      const url = m.file_url || ''
      return url.includes('/offer-media/') ? url.split('/offer-media/')[1] : url
    }).filter(Boolean)
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(filePaths)
      if (storageError) {
        console.error('Storage-Löschfehler (wird ignoriert):', storageError.message)
      }
    }
  }

  await supabase.from('offer_media').delete().eq('offer_id', offerId)
}

/**
 * Lädt alle Medien eines Angebots und erzeugt signierte URLs (1 Stunde gültig).
 * Fallback: public URL falls signed URL fehlschlägt.
 */
export async function loadOfferMedia(offerId) {
  const { data, error } = await supabase
    .from('offer_media')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at')

  if (error) {
    console.error('offer_media Ladefehler:', error.message, error)
    throw error
  }

  if (!data || data.length === 0) return []

  const withUrls = await Promise.all(
    data.map(async item => {
      // Zuerst: public URL (synchron, kein API-Call nötig)
      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(item.file_url)
      const publicUrl = publicData?.publicUrl || null

      // Zusätzlich: signed URL (für private Buckets, 1 Stunde gültig)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(item.file_url, 3600)

      if (urlError) {
        console.error('Signed URL Fehler für', item.file_url, ':', urlError.message, '| Public URL:', publicUrl)
      } else {
        isDev && console.log('URL OK für', item.file_name, '| signed:', !!urlData?.signedUrl, '| public:', !!publicUrl)
      }

      // Signed URL bevorzugen (private Bucket), Fallback auf public URL
      const resolvedUrl = urlData?.signedUrl || publicUrl || null

      if (!resolvedUrl) {
        console.warn('KEINE URL für:', item.file_url, '– Bucket "offer-media" fehlt oder kein Zugriff')
      }

      return { ...item, signed_url: resolvedUrl }
    })
  )
  return withUrls
}
