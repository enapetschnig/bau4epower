import { supabase } from './supabase.js'

const BUCKET = 'offer-media'
const MEDIA_PREFIX = 'protokoll'

export async function saveProtokoll({ userId, projektnummer, adresse, betrifft, eintraege, protokollData }) {
  const { data, error } = await supabase
    .from('protokolle')
    .insert({
      created_by: userId,
      hero_projektnummer: projektnummer || null,
      adresse: adresse || null,
      betrifft: betrifft || null,
      eintraege,
      protokoll_data: protokollData,
      status: 'entwurf',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadProtokolle() {
  const { data, error } = await supabase
    .from('protokolle')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadProtokoll(id) {
  const { data, error } = await supabase
    .from('protokolle')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateProtokollStatus(id, status) {
  const { error } = await supabase
    .from('protokolle')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function deleteProtokoll(id) {
  const { error } = await supabase
    .from('protokolle')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateProtokollData(id, protokollData) {
  const { error } = await supabase
    .from('protokolle')
    .update({ protokoll_data: protokollData })
    .eq('id', id)
  if (error) throw error
}

/**
 * Lädt Medien für ein Protokoll hoch und speichert Einträge in protokoll_media.
 * files = Array von { file: File, isVideo: boolean }
 */
export async function uploadProtokollMedia(protokollId, files) {
  const results = []
  for (const item of files) {
    const file = item.file
    if (!file) continue
    const ext = file.name.split('.').pop() || 'jpg'
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = `${MEDIA_PREFIX}/${protokollId}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: true })
    if (uploadError) throw uploadError

    const { error: dbError } = await supabase
      .from('protokoll_media')
      .insert({
        protokoll_id: protokollId,
        file_name: file.name,
        file_url: storagePath,
        file_type: file.type || (item.isVideo ? 'video/mp4' : 'image/jpeg'),
        file_size: file.size,
      })
    if (dbError) throw dbError

    results.push({ path: storagePath, name: file.name })
  }
  return results
}

/**
 * Lädt alle Medien eines Protokolls mit signierten URLs.
 */
export async function loadProtokollMedia(protokollId) {
  const { data, error } = await supabase
    .from('protokoll_media')
    .select('*')
    .eq('protokoll_id', protokollId)
    .order('created_at')
  if (error) throw error
  if (!data || data.length === 0) return []

  return Promise.all(
    data.map(async item => {
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(item.file_url)
      const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_url, 3600)
      return { ...item, signed_url: urlData?.signedUrl || publicData?.publicUrl || null }
    })
  )
}

/**
 * Löscht ein einzelnes Medium aus Storage und DB.
 */
export async function deleteProtokollMedia(mediaId) {
  const { data: item } = await supabase.from('protokoll_media').select('file_url').eq('id', mediaId).single()
  if (item?.file_url) {
    await supabase.storage.from(BUCKET).remove([item.file_url])
  }
  const { error } = await supabase.from('protokoll_media').delete().eq('id', mediaId)
  if (error) throw error
}

/**
 * Lädt Medien-Anzahlen für mehrere Protokolle auf einmal.
 * Gibt Map zurück: { [protokollId]: count }
 */
export async function loadProtokollMediaCounts(protokollIds) {
  if (!protokollIds.length) return {}
  const { data } = await supabase
    .from('protokoll_media')
    .select('protokoll_id, file_type')
    .in('protokoll_id', protokollIds)
  if (!data) return {}
  return data.reduce((acc, m) => {
    acc[m.protokoll_id] = (acc[m.protokoll_id] || 0) + 1
    return acc
  }, {})
}
