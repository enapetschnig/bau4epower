import { supabase } from './supabase.js'

export async function loadPvProducts(category = null) {
  let q = supabase
    .from('pv_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function loadAllPvProducts() {
  const { data, error } = await supabase
    .from('pv_products')
    .select('*')
    .order('category')
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createPvProduct(payload) {
  const { data, error } = await supabase
    .from('pv_products')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePvProduct(id, updates) {
  const { error } = await supabase
    .from('pv_products')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deletePvProduct(id) {
  const { error } = await supabase
    .from('pv_products')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Estimate Montagematerial-Preis basierend auf Modul-Anzahl + Dachtyp
export function calcMontagePreis(modulAnzahl, dachtyp) {
  const proModul = {
    'ziegel': 38,
    'blech': 32,
    'flachdach': 55,
    'bitumen': 42,
  }[dachtyp] || 38
  return Math.round(modulAnzahl * proModul)
}

// Schätze DC/AC-Installationsmaterial je nach kWp
export function calcInstallationPreis(kwp) {
  if (kwp <= 5) return 480
  if (kwp <= 10) return 650
  if (kwp <= 15) return 850
  return 1100
}

export function calcMontageZeit(modulAnzahl) {
  // ca. 1.5 Stunden pro Modul
  return Math.round(modulAnzahl * 90)
}
