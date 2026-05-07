import { supabase } from './supabase.js'

export async function loadMyDisturbances(userId) {
  const { data, error } = await supabase
    .from('disturbances')
    .select('*, project_records(id, name)')
    .eq('user_id', userId)
    .order('datum', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadAllDisturbances() {
  const { data, error } = await supabase
    .from('disturbances')
    .select('*, project_records(id, name)')
    .order('datum', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadDisturbance(id) {
  const { data, error } = await supabase
    .from('disturbances')
    .select('*, project_records(id, name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createDisturbance(payload) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { data, error } = await supabase
    .from('disturbances')
    .insert({ ...payload, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDisturbance(id, updates) {
  const { error } = await supabase.from('disturbances').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteDisturbance(id) {
  const { error } = await supabase.from('disturbances').delete().eq('id', id)
  if (error) throw error
}

// Materials
export async function loadDisturbanceMaterials(disturbanceId) {
  const { data, error } = await supabase
    .from('disturbance_materials')
    .select('*')
    .eq('disturbance_id', disturbanceId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function addDisturbanceMaterial(disturbanceId, material, menge, einheit) {
  const { data, error } = await supabase
    .from('disturbance_materials')
    .insert({ disturbance_id: disturbanceId, material, menge: menge ? Number(menge) : null, einheit })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDisturbanceMaterial(id) {
  const { error } = await supabase.from('disturbance_materials').delete().eq('id', id)
  if (error) throw error
}

// Photos
export async function loadDisturbancePhotos(disturbanceId) {
  const { data, error } = await supabase
    .from('disturbance_photos')
    .select('*')
    .eq('disturbance_id', disturbanceId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function uploadDisturbancePhoto(disturbanceId, file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${disturbanceId}/${safeName}`

  const { error: upErr } = await supabase.storage.from('disturbance-photos').upload(path, file)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('disturbance_photos')
    .insert({
      disturbance_id: disturbanceId,
      file_name: file.name,
      file_url: path,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDisturbancePhotoUrl(photo) {
  const { data, error } = await supabase.storage
    .from('disturbance-photos')
    .createSignedUrl(photo.file_url, 3600)
  if (error) throw error
  return data?.signedUrl
}

export async function deleteDisturbancePhoto(photo) {
  await supabase.storage.from('disturbance-photos').remove([photo.file_url])
  const { error } = await supabase.from('disturbance_photos').delete().eq('id', photo.id)
  if (error) throw error
}
