import { supabase } from './supabase.js'

export const FOERDERUNG_KATEGORIEN = [
  { v: 'modul', l: 'PV-Module' },
  { v: 'speicher', l: 'Energiespeicher' },
  { v: 'wallbox', l: 'Wallbox' },
  { v: 'heizstab', l: 'Heizstab' },
  { v: 'pauschal', l: 'Pauschal' },
  { v: 'sonstiges', l: 'Sonstiges' },
]

export const ABRECHNUNGSARTEN_F = [
  { v: 'pro_kwp', l: 'pro kWp', desc: 'Pro Kilowatt-peak Anlagenleistung' },
  { v: 'pro_kwh', l: 'pro kWh', desc: 'Pro Kilowattstunde Speicher' },
  { v: 'pauschal', l: 'Pauschal', desc: 'Fixer Betrag' },
  { v: 'prozent', l: 'Prozent', desc: 'Prozent vom Netto' },
]

export async function loadFoerderungen() {
  const { data, error } = await supabase
    .from('foerderungen')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function loadAllFoerderungen() {
  const { data, error } = await supabase
    .from('foerderungen')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createFoerderung(payload) {
  const { data, error } = await supabase.from('foerderungen').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateFoerderung(id, updates) {
  const { error } = await supabase.from('foerderungen').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteFoerderung(id) {
  const { error } = await supabase.from('foerderungen').delete().eq('id', id)
  if (error) throw error
}

/**
 * Berechnet den Förderungsbetrag basierend auf Kategorie/Abrechnung und Anlagedaten.
 *
 * @param {object} foerderung Die Förderung-Definition
 * @param {object} ctx Context: { kwp, speicher_kwh, hat_wallbox, hat_heizstab, brutto, netto }
 */
export function calcFoerderung(foerderung, ctx) {
  const { kwp = 0, speicher_kwh = 0, hat_wallbox = false, hat_heizstab = false, netto = 0 } = ctx
  let betrag = 0

  // Eligibility
  if (foerderung.kategorie === 'wallbox' && !hat_wallbox) return 0
  if (foerderung.kategorie === 'heizstab' && !hat_heizstab) return 0
  if (foerderung.kategorie === 'speicher' && speicher_kwh <= 0) return 0
  if (foerderung.min_anlage_kwp && kwp < Number(foerderung.min_anlage_kwp)) return 0
  if (foerderung.max_anlage_kwp && kwp > Number(foerderung.max_anlage_kwp)) return 0

  switch (foerderung.abrechnungsart) {
    case 'pro_kwp':
      betrag = kwp * Number(foerderung.betrag)
      break
    case 'pro_kwh':
      betrag = speicher_kwh * Number(foerderung.betrag)
      break
    case 'pauschal':
      betrag = Number(foerderung.betrag)
      break
    case 'prozent':
      betrag = (netto * Number(foerderung.betrag)) / 100
      break
  }

  if (foerderung.max_betrag && betrag > Number(foerderung.max_betrag)) {
    betrag = Number(foerderung.max_betrag)
  }
  return Math.round(betrag * 100) / 100
}
