import { supabase } from './supabase.js'

export const GEWERKE = [
  { v: 'elektro', l: 'Elektroinstallation', kurz: 'Elektro', color: 'amber' },
  { v: 'pv', l: 'Photovoltaik', kurz: 'PV', color: 'emerald' },
  { v: 'installateur', l: 'Installateur', kurz: 'Installateur', color: 'blue' },
]

export function gewerkLabel(g) {
  return GEWERKE.find(x => x.v === g)?.l || g
}
export function gewerkKurz(g) {
  return GEWERKE.find(x => x.v === g)?.kurz || g
}

export async function loadProjects(filter = {}) {
  let q = supabase.from('project_records').select('*').order('projekt_nummer', { ascending: false })
  if (filter.gewerk) q = q.eq('gewerk', filter.gewerk)
  if (filter.status) q = q.eq('status', filter.status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function loadProject(id) {
  const { data, error } = await supabase.from('project_records').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function checkProjectNumber(nummer) {
  const { data, error } = await supabase
    .from('project_records')
    .select('id, projekt_nummer, kunde_name, name')
    .eq('projekt_nummer', nummer)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createProject({ userId, projekt_nummer, gewerk, name, kunde_name, beschreibung, adresse, plz }) {
  if (!projekt_nummer) throw new Error('Projektnummer erforderlich')
  if (!gewerk) throw new Error('Gewerk erforderlich')

  // Dopplungs-Check
  const existing = await checkProjectNumber(projekt_nummer)
  if (existing) {
    throw new Error(`Projekt ${projekt_nummer} existiert bereits (${existing.kunde_name || existing.name})`)
  }

  const { data, error } = await supabase
    .from('project_records')
    .insert({
      created_by: userId,
      projekt_nummer,
      gewerk,
      name: name || (kunde_name || 'Projekt'),
      kunde_name: kunde_name || null,
      beschreibung: beschreibung || '',
      adresse: adresse || '',
      plz: plz || '',
      status: 'aktiv',
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`Projekt ${projekt_nummer} existiert bereits`)
    throw error
  }
  return data
}

export async function updateProject(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('project_records').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteProject(id) {
  const { error } = await supabase.from('project_records').delete().eq('id', id)
  if (error) throw error
}

export function projectLabel(p) {
  if (!p) return ''
  const parts = [p.projekt_nummer]
  if (p.kunde_name) parts.push(p.kunde_name)
  else if (p.name) parts.push(p.name)
  return parts.filter(Boolean).join(' · ')
}
