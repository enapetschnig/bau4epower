/**
 * addressLookup.js
 * Zuverlässige Adress-Anreicherung via OpenStreetMap Nominatim.
 * Kein API-Key nötig, kostenlos, kennt alle österreichischen Adressen.
 *
 * Ablauf:
 *  1. Nominatim (OpenStreetMap) → korrekte PLZ + Straßenname
 *  2. Falls Nominatim schlägt fehl → Claude API als Fallback
 */

import { callClaude } from './claude.js'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'BAU4YOU-Angebots-App/2.0 (bau4you.at)'

/**
 * Formatiert eine Adresse ins Hero-Format:
 * "Straße Hausnr [Stiege X] [Top Y], PLZ Ort"
 */
function formatAdresseLocal(addr) {
  if (!addr) return addr
  return addr
    .replace(/\s*\/\s*/g, ' ')      // Schrägstriche → Leerzeichen
    .replace(/\s{2,}/g, ' ')        // Mehrfache Leerzeichen → eins
    .trim()
}

/**
 * Trennt Top/Stiege/Tür vom Straßenteil (steht in keinem Stadtplan).
 * Gibt { street, unit } zurück.
 */
function splitUnit(address) {
  if (!address) return { street: address || '', unit: '' }

  // PLZ + Ort am Ende abtrennen
  const plzMatch = address.match(/,\s*\d{4}\s+\S.*$/)
  const plzSuffix = plzMatch ? plzMatch[0] : ''
  const withoutPlz = plzSuffix ? address.slice(0, -plzSuffix.length).trim() : address

  // Unit-Suffixe: "Top 3", "Stiege 2", "Tür 4", "Keller", "/3", "EG", ...
  const UNIT_RE = /\s+(?:(?:Stiege|Stg\.?|Top|Tür|Tuer|T\.|Keller|Kell\.?|EG|OG\s*\d*|DG|Stock)\s*\d*\w*(?:\s+(?:Stiege|Stg\.?|Top|Tür|T\.|Keller)\s*\d*\w*)*|\/\s*\d+\w*)$/i
  const unitMatch = withoutPlz.match(UNIT_RE)
  if (unitMatch) {
    return {
      street: (withoutPlz.slice(0, unitMatch.index).trim() + plzSuffix).trim(),
      unit: unitMatch[0].trim(),
    }
  }
  return { street: (withoutPlz + plzSuffix).trim(), unit: '' }
}

/**
 * Fügt Unit-Suffix wieder vor die PLZ ein.
 */
function reattachUnit(enriched, unit) {
  if (!unit) return enriched
  const plzIdx = enriched.search(/,\s*\d{4}/)
  if (plzIdx > -1) {
    return enriched.slice(0, plzIdx) + ' ' + unit + enriched.slice(plzIdx)
  }
  return enriched + ' ' + unit
}

/**
 * Extrahiert die Hausnummer aus einem Straßen-String.
 * "Rennweg 20" → "20", "Quellenstraße 10a" → "10a", "Rennweg" → ""
 */
function extractHouseNumber(streetInput) {
  if (!streetInput) return ''
  const m = streetInput.match(/\s+(\d+[a-z]?)\s*$/i)
  return m ? m[1] : ''
}

/**
 * Parsed Nominatim-Ergebnis → formatierte Adresse oder null.
 * inputStreet: der Original-Input (z.B. "Rennweg 20") — wird als Fallback
 * für die Hausnummer verwendet, falls Nominatim sie nicht zurückgibt.
 */
function parseNominatimResult(data, inputStreet) {
  if (!data || data.length === 0) return null

  const a = data[0].address
  const road = a.road || a.pedestrian || a.footway || a.path || a.street || ''
  // Hausnummer: Nominatim-Ergebnis bevorzugen, sonst aus Input extrahieren
  const houseNumber = a.house_number || extractHouseNumber(inputStreet) || ''
  const postcode = a.postcode || ''
  const city = a.city || a.town || a.village || a.municipality || a.county || ''

  if (!road || !postcode || !city) return null

  let result = road
  if (houseNumber) result += ' ' + houseNumber
  result += ', ' + postcode + ' ' + city

  return formatAdresseLocal(result)
}

/**
 * Schritt 1: OpenStreetMap Nominatim
 * Sucht die Adresse ZUERST in Wien (viewbox + bounded), dann ganz Österreich.
 * BAU4YOU arbeitet zu 99 % in Wien → Wien wird immer bevorzugt.
 */
async function lookupViaNominatim(streetOnly) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': USER_AGENT,
  }

  // --- Versuch 1: Nur Wien (Bounding-Box Wien + bounded=1) ---
  // Wien Bounding-Box: SW 48.118, 16.183 → NE 48.323, 16.577
  const wienQuery = encodeURIComponent(streetOnly + ', Wien')
  const wienUrl = `${NOMINATIM_BASE}?format=json&addressdetails=1&limit=1&countrycodes=at`
    + `&viewbox=16.183,48.118,16.577,48.323&bounded=1&q=${wienQuery}`

  try {
    const wienRes = await fetch(wienUrl, { headers })
    if (wienRes.ok) {
      const wienData = await wienRes.json()
      const wienResult = parseNominatimResult(wienData, streetOnly)
      if (wienResult) return wienResult
    }
  } catch {
    // Wien-Suche fehlgeschlagen → weiter mit ganz Österreich
  }

  // --- Versuch 2: Ganz Österreich (kein viewbox) ---
  const atQuery = encodeURIComponent(streetOnly + ', Österreich')
  const atUrl = `${NOMINATIM_BASE}?format=json&addressdetails=1&limit=1&countrycodes=at&q=${atQuery}`

  const res = await fetch(atUrl, { headers })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = await res.json()

  return parseNominatimResult(data, streetOnly)
}

/**
 * Schritt 2: Claude API Fallback
 * Nur wenn Nominatim keine Antwort liefert.
 */
async function lookupViaClaude(streetOnly) {
  const response = await callClaude(
    `Du bist ein österreichischer Adress-Experte.
Antworte NUR im Format: "Straße Hausnummer, PLZ Ort"
Beispiele: "Rennweg 20, 1030 Wien" | "Mariahilfer Straße 10, 1060 Wien" | "Hauptstraße 5, 2102 Bisamberg"
REGELN:
- Korrekte offizielle Straßennamen-Schreibweise
- Komma + Leerzeichen vor PLZ, PLZ 4-stellig
- Wien: Bezirk-PLZ (1. Bezirk→1010, 2.→1020, ..., 23.→1230)
- NUR Straße + Hausnummer + PLZ + Ort, KEIN sonstiger Text`,
    `Adresse: ${streetOnly}`,
    () => {},
    80,
  )
  const cleaned = response.trim().replace(/^["'\s]+|["'\s]+$/g, '').replace(/\.$/, '')
  const formatted = formatAdresseLocal(cleaned)
  if (!formatted || !/\d{4}/.test(formatted)) return null
  return formatted
}

/**
 * Hauptfunktion: Reichert eine rohe Adresse mit PLZ an.
 * 1. Nominatim → 2. Claude Fallback → 3. null wenn beides schlägt fehl
 *
 * @param {string} address  Roh-Adresse (z.B. "Rennweg 20 Wien" oder "Quellenstr 12 Top 3")
 * @returns {Promise<string|null>} Angereicherte Adresse im Hero-Format oder null
 */
export async function enrichAddressWithPlz(address) {
  if (!address) return null
  const { street, unit } = splitUnit(address)
  if (!street) return null

  let enriched = null

  // Versuch 1: OpenStreetMap Nominatim (zuverlässig, gratis, kein API-Key)
  try {
    enriched = await lookupViaNominatim(street)
  } catch {
    // Nominatim nicht erreichbar → weiter zum Fallback
  }

  // Versuch 2: Claude API Fallback
  if (!enriched) {
    try {
      enriched = await lookupViaClaude(street)
    } catch {
      // Claude ebenfalls nicht erreichbar
    }
  }

  if (!enriched) return null
  return reattachUnit(enriched, unit)
}
