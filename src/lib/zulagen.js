import { supabase } from './supabase.js'

export const ABRECHNUNGSARTEN = [
  { v: 'pro_tag', l: 'pro Tag', desc: 'Einmalig pro Arbeitstag' },
  { v: 'pro_eintrag', l: 'pro Eintrag', desc: 'Pro Zeit-Eintrag einmalig' },
  { v: 'pro_stunde', l: 'pro Stunde', desc: 'Pro gearbeiteter Stunde' },
  { v: 'pauschal', l: 'Pauschal', desc: 'Frei wählbarer Betrag' },
]

export async function loadZulagen() {
  const { data, error } = await supabase
    .from('zulagen')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function loadAllZulagen() {
  const { data, error } = await supabase
    .from('zulagen')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createZulage(payload) {
  const { data, error } = await supabase.from('zulagen').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateZulage(id, updates) {
  const { error } = await supabase.from('zulagen').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteZulage(id) {
  const { error } = await supabase.from('zulagen').delete().eq('id', id)
  if (error) throw error
}

// ─── Zeit-Eintrag-Zulagen ───
export async function loadEntryZulagen(timeEntryId) {
  const { data, error } = await supabase
    .from('time_entry_zulagen')
    .select('*, zulagen(*)')
    .eq('time_entry_id', timeEntryId)
  if (error) throw error
  return data || []
}

export async function loadZulagenForEntries(entryIds) {
  if (!entryIds || entryIds.length === 0) return []
  const { data, error } = await supabase
    .from('time_entry_zulagen')
    .select('*, zulagen(*)')
    .in('time_entry_id', entryIds)
  if (error) throw error
  return data || []
}

export async function addEntryZulage({ timeEntryId, zulageId, menge, betrag, notiz }) {
  const { data, error } = await supabase
    .from('time_entry_zulagen')
    .insert({
      time_entry_id: timeEntryId,
      zulage_id: zulageId,
      menge: menge || 1,
      betrag: betrag || null,
      notiz: notiz || null,
    })
    .select('*, zulagen(*)')
    .single()
  if (error) throw error
  return data
}

export async function removeEntryZulage(id) {
  const { error } = await supabase.from('time_entry_zulagen').delete().eq('id', id)
  if (error) throw error
}

// ─── Foto-Upload für Zeit-Eintrag ───
export async function uploadTimeEntryPhoto(timeEntryId, projectId, userId, file) {
  const ext = (file.name || 'photo').split('.').pop() || 'jpg'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${userId}/${timeEntryId}/${safeName}`

  const { error: upErr } = await supabase.storage
    .from('time-entry-photos')
    .upload(path, file)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('time_entry_photos')
    .insert({
      time_entry_id: timeEntryId,
      project_id: projectId || null,
      user_id: userId,
      file_name: file.name,
      file_url: path,
      file_type: file.type,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadTimeEntryPhotos(timeEntryId) {
  const { data, error } = await supabase
    .from('time_entry_photos')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function getTimeEntryPhotoUrl(photo) {
  const { data, error } = await supabase.storage
    .from('time-entry-photos')
    .createSignedUrl(photo.file_url, 3600)
  if (error) throw error
  return data?.signedUrl
}

export async function deleteTimeEntryPhoto(photo) {
  await supabase.storage.from('time-entry-photos').remove([photo.file_url])
  const { error } = await supabase.from('time_entry_photos').delete().eq('id', photo.id)
  if (error) throw error
}

// Berechne Zulagen-Betrag für einen Eintrag
export function calcZulageBetrag(zulage, menge, stunden) {
  const m = Number(menge) || 1
  const s = Number(stunden) || 0
  const def = Number(zulage?.default_betrag) || 0
  switch (zulage?.abrechnungsart) {
    case 'pro_tag': return def * m
    case 'pro_eintrag': return def * m
    case 'pro_stunde': return def * s
    case 'pauschal': return def * m
    default: return def * m
  }
}
