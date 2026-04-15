/**
 * fixGewerkZuordnung.js
 *
 * Keyword-basiertes Post-Processing nach der KI-Antwort.
 * Korrigiert Positionen die von der KI dem falschen Gewerk zugeordnet wurden,
 * basierend auf Schlüsselwörtern im Kurztext und Langtext.
 *
 * Wird NACH enrichFromCatalog / fixGewerkeLeistungsnummern aufgerufen.
 */

const GEWERK_PREFIX = {
  'Gemeinkosten': '01', 'Abbruch': '02', 'Installateur': '06', 'Reinigung': '13',
}

/**
 * SPEZIALREGELN – haben höchste Priorität.
 * Wenn ein Keyword im Kurztext oder Langtext einer Position gefunden wird,
 * wird das Gewerk IMMER auf den definierten Wert gesetzt – egal was die KI sagt.
 *
 * Wichtig: Spezifischere Keywords zuerst (länger, eindeutiger).
 */
const SPEZIAL_REGELN = [
  {
    gewerk: 'Abbruch',
    keywords: [
      'mulde', 'schuttcontainer', 'bauschuttcontainer', 'bauschutt',
      'containerentsorgung', 'entsorgungskosten', 'bauschuttentsorgung',
      'deponie', 'deponiegebühr', 'sperrmüll', 'schuttabfuhr',
    ],
  },
  {
    gewerk: 'Reinigung',
    keywords: [
      'bauschlussreinigung', 'endreinigung', 'besenrein', 'feinrein',
      'grundreinigung', 'fensterreinigung',
    ],
  },
]

/**
 * Normalisiert Text für Keyword-Vergleich (Umlaute, Kleinschreibung).
 */
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}

/**
 * Gibt den korrekten Gewerknamen zurück wenn ein Spezial-Keyword gefunden wird,
 * sonst null (keine Korrektur nötig).
 */
function detectCorrectGewerk(pos) {
  const text = norm(`${pos.leistungsname || ''} ${pos.beschreibung || ''}`)
  for (const { gewerk, keywords } of SPEZIAL_REGELN) {
    if (keywords.some(kw => text.includes(norm(kw)))) {
      return gewerk
    }
  }
  return null
}

/**
 * Passt die Leistungsnummer an wenn das Gewerk wechselt:
 * - Katalog-Nummern (XX-NNN) werden nicht verändert – die Nummer bestimmt das Gewerk.
 * - NEU-Nummern (XX-NEU, XX-NEU1 etc.) bekommen den neuen Prefix.
 */
function adjustLeistungsnummer(leistungsnummer, newGewerk) {
  const nr = String(leistungsnummer || '')
  const newPrefix = GEWERK_PREFIX[newGewerk]
  if (!newPrefix) return nr

  // Nur NEU-Nummern anpassen
  const neuMatch = nr.match(/^\d{2}-(NEU\d*)$/)
  if (neuMatch) {
    return `${newPrefix}-${neuMatch[1]}`
  }

  // Katalog-Nummern nicht verändern
  return nr
}

/**
 * Verschiebt eine Position in den richtigen Gewerk-Bucket.
 * Erstellt das Gewerk wenn es noch nicht existiert.
 */
function routePosition(pos, targetGewerk, buckets) {
  if (!buckets[targetGewerk]) {
    buckets[targetGewerk] = { name: targetGewerk, positionen: [] }
  }
  const adjustedNr = adjustLeistungsnummer(pos.leistungsnummer, targetGewerk)
  buckets[targetGewerk].positionen.push({
    ...pos,
    gewerk: targetGewerk,
    leistungsnummer: adjustedNr,
  })
}

/**
 * Hauptfunktion: Korrigiert die Gewerk-Zuordnung aller Positionen.
 *
 * @param {Array} gewerke  - Array von { name, positionen, zwischensumme }
 * @returns {Array}        - Korrigiertes Array, leere Gewerke werden entfernt
 */
export function fixGewerkZuordnung(gewerke) {
  if (!gewerke || gewerke.length === 0) return gewerke

  // Buckets aus bestehenden Gewerken aufbauen
  const buckets = {}
  for (const g of gewerke) {
    buckets[g.name] = { ...g, positionen: [] }
  }

  let changed = false

  for (const gewerk of gewerke) {
    for (const pos of (gewerk.positionen || [])) {
      const correctGewerk = detectCorrectGewerk(pos)

      if (correctGewerk && correctGewerk !== gewerk.name) {
        console.log(
          `[fixGewerkZuordnung] "${pos.leistungsname}" (${pos.leistungsnummer}): ` +
          `${gewerk.name} → ${correctGewerk}`
        )
        routePosition(pos, correctGewerk, buckets)
        changed = true
      } else {
        // Position bleibt im ursprünglichen Gewerk
        if (!buckets[gewerk.name]) {
          buckets[gewerk.name] = { ...gewerk, positionen: [] }
        }
        buckets[gewerk.name].positionen.push(pos)
      }
    }
  }

  if (!changed) return gewerke

  // Ergebnis in der ursprünglichen Reihenfolge zusammenbauen,
  // dann neu hinzugekommene Gewerke anhängen
  const result = []
  const seen = new Set()

  for (const g of gewerke) {
    if (!seen.has(g.name) && buckets[g.name]) {
      const b = buckets[g.name]
      result.push({
        ...b,
        zwischensumme: b.positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0),
      })
      seen.add(g.name)
    }
  }
  for (const [name, b] of Object.entries(buckets)) {
    if (!seen.has(name) && b.positionen.length > 0) {
      result.push({
        ...b,
        zwischensumme: b.positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0),
      })
    }
  }

  return result.filter(g => (g.positionen || []).length > 0)
}
