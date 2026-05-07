import { supabase } from './supabase.js'

export async function loadPvOffers() {
  const { data, error } = await supabase
    .from('pv_offers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadPvOffer(id) {
  const { data, error } = await supabase
    .from('pv_offers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

async function generateBelegNr() {
  const { data, error } = await supabase.rpc('generate_pv_beleg_nr')
  if (error || !data) {
    // Fallback
    const yr = new Date().getFullYear()
    return `${yr}${String(Date.now()).slice(-4)}`
  }
  return data
}

export async function createPvOffer(payload) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  const beleg_nr = payload.beleg_nr || (await generateBelegNr())

  const { data, error } = await supabase
    .from('pv_offers')
    .insert({
      ...payload,
      beleg_nr,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePvOffer(id, updates) {
  const { error } = await supabase
    .from('pv_offers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deletePvOffer(id) {
  const { error } = await supabase
    .from('pv_offers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Calculate totals from positionen array (groups with sub-items)
export function calculateTotals(gruppen) {
  let netto = 0
  for (const gruppe of gruppen) {
    for (const pos of (gruppe.positionen || [])) {
      const sub = (Number(pos.menge) || 0) * (Number(pos.preis) || 0)
      netto += sub
    }
  }
  netto = Math.round(netto * 100) / 100
  const mwst = Math.round(netto * 0.20 * 100) / 100
  const brutto = Math.round((netto + mwst) * 100) / 100
  return { netto, mwst, brutto }
}
