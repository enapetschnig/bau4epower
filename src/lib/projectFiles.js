import { supabase } from './supabase.js'

const CATEGORY_BUCKET = {
  plaene: 'project-plans',
  berichte: 'project-reports',
  fotos: 'project-photos',
  chef: 'project-chef',
}

export const CATEGORIES = [
  { v: 'plaene', l: 'Pläne', desc: 'Baupläne, Schaltpläne, Skizzen' },
  { v: 'berichte', l: 'Berichte', desc: 'Bautagesberichte, Protokolle' },
  { v: 'fotos', l: 'Fotos', desc: 'Baustellen-Fotos, Bilddokumentation' },
  { v: 'chef', l: 'Chefordner', desc: 'Nur für Administratoren' },
]

export async function listProjectFiles(projectId, category = null) {
  let q = supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function uploadProjectFile(projectId, category, file) {
  const bucket = CATEGORY_BUCKET[category]
  if (!bucket) throw new Error('Unbekannte Kategorie')
  const userId = (await supabase.auth.getUser()).data.user?.id
  const ext = file.name.split('.').pop() || 'bin'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${projectId}/${safeName}`

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
  })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      category,
      file_name: file.name,
      file_url: path,
      file_type: file.type,
      file_size: file.size,
      bucket,
      uploaded_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProjectFile(fileRow) {
  await supabase.storage.from(fileRow.bucket).remove([fileRow.file_url])
  const { error } = await supabase.from('project_files').delete().eq('id', fileRow.id)
  if (error) throw error
}

export async function getProjectFileUrl(fileRow) {
  if (fileRow.bucket === 'project-photos') {
    const { data } = supabase.storage.from(fileRow.bucket).getPublicUrl(fileRow.file_url)
    return data?.publicUrl
  }
  const { data, error } = await supabase.storage.from(fileRow.bucket)
    .createSignedUrl(fileRow.file_url, 3600)
  if (error) throw error
  return data?.signedUrl
}

export async function listProjectMaterials(projectId) {
  const { data, error } = await supabase
    .from('material_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addProjectMaterial({ projectId, material, menge, einheit, notizen }) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const { data, error } = await supabase
    .from('material_entries')
    .insert({
      project_id: projectId,
      user_id: userId,
      material,
      menge: menge ? Number(menge) : null,
      einheit: einheit || null,
      notizen: notizen || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMaterial(id) {
  const { error } = await supabase
    .from('material_entries')
    .delete()
    .eq('id', id)
  if (error) throw error
}
