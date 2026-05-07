import { supabase } from './supabase.js'

export async function loadProjects() {
  const { data, error } = await supabase
    .from('project_records')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadProject(id) {
  const { data, error } = await supabase
    .from('project_records')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject({ userId, name, beschreibung, adresse, plz }) {
  const { data, error } = await supabase
    .from('project_records')
    .insert({
      created_by: userId,
      name,
      beschreibung: beschreibung || '',
      adresse: adresse || '',
      plz: plz || '',
      status: 'aktiv',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProject(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('project_records')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

export async function deleteProject(id) {
  const { error } = await supabase
    .from('project_records')
    .delete()
    .eq('id', id)
  if (error) throw error
}
