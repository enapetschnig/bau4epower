import { supabase } from './supabase.js'

// ── Save new Aufmaß ──────────────────────────────────────────────
export async function saveAufmass({ userId, projektnummer, adresse, betrifft, aufmassData }) {
  const { data, error } = await supabase
    .from('aufmaesse')
    .insert({
      created_by: userId,
      hero_projektnummer: projektnummer || null,
      adresse: adresse || null,
      betrifft: betrifft || null,
      aufmass_data: aufmassData,
      status: 'entwurf',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Load all Aufmaße ─────────────────────────────────────────────
export async function loadAufmaesse() {
  const { data, error } = await supabase
    .from('aufmaesse')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Load single Aufmaß ──────────────────────────────────────────
export async function loadAufmass(id) {
  const { data, error } = await supabase
    .from('aufmaesse')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ── Update Aufmaß data ──────────────────────────────────────────
export async function updateAufmass(id, updates) {
  const { data, error } = await supabase
    .from('aufmaesse')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Delete Aufmaß ───────────────────────────────────────────────
export async function deleteAufmass(id) {
  const { error } = await supabase
    .from('aufmaesse')
    .delete()
    .eq('id', id)
  if (error) throw error
}
