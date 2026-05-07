import { supabase } from './supabase.js'

export async function loadProjects() {
  const { data, error } = await supabase
    .from('project_records')
    .select('*')
    .order('projekt_nummer', { ascending: false })
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

export async function createProject({ userId, name, kunde_name, beschreibung, adresse, plz }) {
  const { data, error } = await supabase
    .from('project_records')
    .insert({
      created_by: userId,
      name: name || (kunde_name || 'Projekt'),
      kunde_name: kunde_name || null,
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

export function projectLabel(p) {
  if (!p) return ''
  const parts = [p.projekt_nummer]
  if (p.kunde_name) parts.push(p.kunde_name)
  else if (p.name) parts.push(p.name)
  return parts.filter(Boolean).join(' · ')
}
