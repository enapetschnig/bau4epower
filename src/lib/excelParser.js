import * as XLSX from 'xlsx'

const GEWERK_PREFIX = {
  '01': 'Gemeinkosten',
  '02': 'Abbruch',
  '03': 'Bautischler',
  '04': 'Glaser',
  '05': 'Elektriker',
  '06': 'Installateur',
  '07': 'Baumeister',
  '08': 'Trockenbau',
  '09': 'Maler',
  '10': 'Anstreicher',
  '11': 'Fliesenleger',
  '12': 'Bodenleger',
  '13': 'Reinigung',
  '16': 'Elektrozuleitung',
}

function getGewerkFromNr(nr) {
  if (!nr) return 'Sonstiges'
  const str = String(nr).trim()
  const prefix = str.substring(0, 2)
  return GEWERK_PREFIX[prefix] || 'Sonstiges'
}

function isRegiestunde(name, einheit) {
  return (
    String(name || '').toLowerCase().includes('regiestunden') &&
    String(einheit || '').toLowerCase().includes('std')
  )
}

/**
 * Parse Excel file (.xlsx) with sheet "Leistungen"
 * Columns: Nr | Name | Gewerk | Einheit | Preis (€) | Zeit (min) | Material | Beschreibung
 * Returns: { positionen, stundensaetze }
 */
export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Find sheet "Leistungen" (case-insensitive)
  const sheetName = workbook.SheetNames.find(
    n => n.toLowerCase() === 'leistungen'
  ) || workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rows.length < 2) throw new Error('Sheet "Leistungen" enthält keine Daten')

  // Detect header row – find row where cells match expected column names
  const headerRow = rows[0]
  const colIndex = detectColumns(headerRow)

  const positionen = []
  const stundensaetze = {}

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const nr = String(row[colIndex.nr] ?? '').trim()
    const name = String(row[colIndex.name] ?? '').trim()
    const einheit = String(row[colIndex.einheit] ?? '').trim()
    const preis = Math.round((parseFloat(row[colIndex.preis]) || 0) * 100) / 100
    const zeit = Math.round(parseFloat(row[colIndex.zeit]) || 0)
    const material = row[colIndex.material]
    const beschreibung = String(row[colIndex.beschreibung] ?? '').trim()

    if (!nr && !name) continue // skip empty rows

    const gewerk = getGewerkFromNr(nr)
    const materialEnthalten = material === 1 || material === '1' || material === true

    if (isRegiestunde(name, einheit)) {
      // Extract Stundensatz for this Gewerk
      stundensaetze[gewerk] = Math.round(preis)
    }
    // Alle Positionen (inkl. Regiestunden -997/-998) in den Katalog aufnehmen
    positionen.push({
      nr,
      name,
      gewerk,
      einheit,
      preis,
      zeit_min: zeit,
      material_enthalten: materialEnthalten,
      beschreibung,
    })
  }

  return { positionen, stundensaetze }
}

function detectColumns(headerRow) {
  // Map header strings to column indices
  const headers = headerRow.map(h => String(h || '').toLowerCase().trim())

  function find(...candidates) {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c))
      if (idx !== -1) return idx
    }
    return -1
  }

  return {
    nr: find('leistungsnummer', 'nr', 'nummer', 'pos') ?? 0,
    name: find('leistungsname', 'name', 'bezeichnung', 'kurztext') ?? 1,
    einheit: find('einheit') ?? 3,
    preis: find('vk neu netto', 'vk netto', 'preis', '€', 'price') ?? 4,
    zeit: find('lohnkosten minuten', 'zeit', 'min') ?? 5,
    material: find('materialkosten', 'material') ?? 6,
    beschreibung: find('beschreibung', 'langtext', 'text') ?? 7,
  }
}
