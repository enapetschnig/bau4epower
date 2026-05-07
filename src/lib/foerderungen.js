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

/**
 * Erkennt Konflikte zwischen ausgewählten Förderungen.
 * Eine Konflikt-Beziehung besteht, wenn A in B.excludes steht ODER B in A.excludes steht.
 *
 * @param {Array<{id:string, name:string, excludes?:string[]}>} selected
 * @returns {Array<{a: object, b: object}>} Liste der Konfliktpaare (eindeutig)
 */
/**
 * Sammelt für eine Förderung alle Gründe, warum sie greift oder NICHT greift.
 * Wird im Editor angezeigt, damit der Bauleiter sofort sieht, warum eine
 * Förderung in seiner Konfiguration anwendbar (oder eben nicht) ist.
 *
 * Rückgabe:
 *   { eligible: bool, reasons: string[], blockers: string[] }
 */
export function eligibilityCheck(foerderung, ctx) {
  const { kwp = 0, speicher_kwh = 0, hat_wallbox = false, hat_heizstab = false } = ctx
  const reasons = []
  const blockers = []

  const kwpStr = kwp ? kwp.toLocaleString('de-AT', { maximumFractionDigits: 2 }) + ' kWp' : '–'
  const kwhStr = speicher_kwh ? speicher_kwh.toLocaleString('de-AT', { maximumFractionDigits: 2 }) + ' kWh' : '–'

  if (foerderung.kategorie === 'wallbox') {
    if (hat_wallbox) reasons.push('Wallbox im Angebot enthalten')
    else blockers.push('Wallbox ist nicht im Angebot')
  }
  if (foerderung.kategorie === 'heizstab') {
    if (hat_heizstab) reasons.push('PV-Heizstab im Angebot enthalten')
    else blockers.push('PV-Heizstab ist nicht im Angebot')
  }
  if (foerderung.kategorie === 'speicher') {
    if (speicher_kwh > 0) reasons.push(`${kwhStr} Speicher im Angebot`)
    else blockers.push('Kein Energiespeicher im Angebot')
  }
  if (foerderung.min_anlage_kwp) {
    const min = Number(foerderung.min_anlage_kwp)
    if (kwp >= min) reasons.push(`Anlage ${kwpStr} ≥ Mindestgröße ${min} kWp`)
    else blockers.push(`Anlage ${kwpStr} unter Mindestgröße ${min} kWp`)
  }
  if (foerderung.max_anlage_kwp) {
    const max = Number(foerderung.max_anlage_kwp)
    if (kwp <= max) reasons.push(`Anlage ${kwpStr} ≤ Höchstgröße ${max} kWp`)
    else blockers.push(`Anlage ${kwpStr} über Höchstgröße ${max} kWp`)
  }

  return { eligible: blockers.length === 0, reasons, blockers }
}

/**
 * Liefert Betrag + menschenlesbare Berechnungsformel ("150 €/kWp × 7,6 kWp").
 * Wird im Editor unter dem Förderbetrag eingeblendet.
 */
export function calcExplained(foerderung, ctx) {
  const { kwp = 0, speicher_kwh = 0, netto = 0 } = ctx
  const betrag = calcFoerderung(foerderung, ctx)
  const f = (n, frac = 0) => Number(n).toLocaleString('de-AT', { maximumFractionDigits: frac })
  let formula = ''
  switch (foerderung.abrechnungsart) {
    case 'pro_kwp':
      formula = `${f(foerderung.betrag, 2)} €/kWp × ${f(kwp, 2)} kWp`
      break
    case 'pro_kwh':
      formula = `${f(foerderung.betrag, 2)} €/kWh × ${f(speicher_kwh, 2)} kWh`
      break
    case 'pauschal':
      formula = `Pauschalbetrag ${f(foerderung.betrag, 2)} €`
      break
    case 'prozent':
      formula = `${f(foerderung.betrag, 2)} % von Netto ${f(netto, 2)} €`
      break
    default:
      formula = ''
  }
  if (foerderung.max_betrag && betrag === Number(foerderung.max_betrag)) {
    formula += ` (Deckel ${f(foerderung.max_betrag, 0)} €)`
  }
  return { betrag, formula }
}

export function detectFoerderungConflicts(selected) {
  const conflicts = []
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const a = selected[i]
      const b = selected[j]
      const exA = Array.isArray(a.excludes) ? a.excludes : []
      const exB = Array.isArray(b.excludes) ? b.excludes : []
      if (exA.includes(b.id) || exB.includes(a.id)) {
        conflicts.push({ a, b })
      }
    }
  }
  return conflicts
}
