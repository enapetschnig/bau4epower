/**
 * Text formatting utilities for speech transcript display.
 */

const isDev = import.meta.env.DEV

/**
 * Whisper context prompt – improves recognition of Austrian construction terms.
 * Passed as `prompt` in FormData to the OpenAI transcriptions endpoint.
 */
export const WHISPER_BAU_PROMPT =
  'Baukalkulation Österreich. Schwimmend verlegt, Fertigparkett schwimmend verlegt abbrechen, ' +
  'Sesselleisten, Sockelleisten, Dübeln entfernen, Vinylboden schwimmend verlegt, ' +
  'Laminat, Parkett, Estrich, Spachtelmasse, Dispersionsfarbe, Grundierung, ' +
  'Rigips, Trockenbau, Gipskarton, Fliesenleger, Bodenleger, Wandfliesen, ' +
  'Bodenfliesen, Sockelleisten, Silikonfugen, Verfugen, Abdichtung, ' +
  'Feinsteinzeug, Dübel entfernen, Abbrucharbeiten, Stemmen, ' +
  'Baustelleneinrichtung, Bauschuttentsorgung, Endreinigung, Malerarbeiten, ' +
  'Anstrich, Verspachtelung, Tapezieren, Quadratmeter, Laufmeter, pauschal, ' +
  'Regiestunden, Stundensatz, Gewerk, Ausmalen, Schleifen, Abdeckarbeiten, ' +
  'Demontage, Montage, Sanitär, Elektro, Rohinstallation, Unterputz, Aufputz, ' +
  'Zuleitung, Spenglerarbeiten, Dachdecker, Zimmerer, Wärmedämmung, ' +
  'Fensterbank, Türstock, Türzarge, Vormauerung, Betonboden, Asphalt, ' +
  'Fugenmasse, Klebemörtel, Fliesenkleber, Nivelliermasse, Glaswolle, ' +
  'Mineralwolle, Dampfsperre, Dampfbremse, Holzunterkonstruktion, ' +
  'Lattung, Konterlattung, Schalung, Vollwärmeschutz, Außenputz, Innenputz.'

const KORREKTUREN = {
  'schwirne': 'schwimmend',
  'schwirme': 'schwimmend',
  'schwirmend': 'schwimmend',
  'schwirnend': 'schwimmend',
  'schiemen': 'schwimmend',
  'schiemend': 'schwimmend',
  'schwimmen verlegt': 'schwimmend verlegt',
  'schwimen verlegt': 'schwimmend verlegt',
  'schimmeln verlegt': 'schwimmend verlegt',
  'schimmel verlegt': 'schwimmend verlegt',
  'schiemen verlegt': 'schwimmend verlegt',
  'schienen verlegt': 'schwimmend verlegt',
  'schiener verlegt': 'schwimmend verlegt',
  'schimmen verlegt': 'schwimmend verlegt',
  'vinylbodenschimmeln': 'Vinylboden schwimmend',
  'vinylbodenschimmel': 'Vinylboden schwimmend',
  'vinylbodenschwimm': 'Vinylboden schwimm',
  'vinylbodenschirm': 'Vinylboden schwimmend',
  'dispertionsfarbe': 'Dispersionsfarbe',
  'vinyl boden': 'Vinylboden',
  'sesselleise': 'Sesselleiste',
  'sessel leiste': 'Sesselleiste',
  'sockelleise': 'Sockelleiste',
  'sockel leiste': 'Sockelleiste',
  'fein steinzeug': 'Feinsteinzeug',
  'feinstein zeug': 'Feinsteinzeug',
  'bau schutt': 'Bauschutt',
  'trocken bau': 'Trockenbau',
  'end reinigung': 'Endreinigung',
  'spachtel masse': 'Spachtelmasse',
  'unter putz': 'Unterputz',
  'auf putz': 'Aufputz',
  'tür zarge': 'Türzarge',
  'fenster bank': 'Fensterbank',
  'auswenden': 'aus der Wand',
  'aus wenden': 'aus der Wand',
  'aus wende': 'aus der Wand',
  'fertig-paket': 'Fertigparkett',
  'fertigpaket': 'Fertigparkett',
  'fertig paket': 'Fertigparkett',
  'abrechen': 'abbrechen',
  'vinylboden-abrechen': 'Vinylboden abbrechen',
  'vinylboden-abbrechen': 'Vinylboden abbrechen',
  'fertig, paket': 'Fertigparkett',
  'fertig,paket': 'Fertigparkett',
  'fertig- paket': 'Fertigparkett',
  'fertig -paket': 'Fertigparkett',
  'fertig packet': 'Fertigparkett',
  'fertig, packet': 'Fertigparkett',
  'fertig parkett': 'Fertigparkett',
  'fertig, parkett': 'Fertigparkett',
}

const SUFFIX_RE = /(entfernen|abbrechen|verlegen|montieren|schleifen|grundieren|streichen|spachteln|verfugen|ausmalen|demontieren|einbauen|liefern|verlegt|montiert)/gi

export function korrigiereTranskription(text) {
  if (!text) return text

  let t = text

  // 0. Bindestriche zwischen Buchstaben zusammenkleben: "Vinyl-Boden" → "Vinylboden"
  // NICHT bei Nummern (02-NEU bleibt 02-NEU)
  t = t.replace(/([a-zA-ZäöüÄÖÜ])-([a-zA-ZäöüÄÖÜ])/g, '$1$2')

  // 0a. Kommas entfernen die Whisper fälschlich zwischen zusammengesetzte Wörter setzt
  // z.B. "Fertig, Paket" → "Fertig Paket"
  t = t.replace(/(\b\w+),\s+(\w+\b)/g, (match, wort1, wort2) => {
    const suffixe = ['paket', 'packet', 'parkett', 'boden', 'decke', 'wand',
      'platte', 'leiste', 'schiene', 'profil', 'masse', 'farbe', 'lack',
      'putz', 'mörtel', 'beton', 'estrich', 'fliese', 'stein', 'zeug']
    if (suffixe.some(s => wort2.toLowerCase().startsWith(s))) {
      return wort1 + ' ' + wort2
    }
    return match
  })

  isDev && console.log('WHISPER RAW:', t.substring(0, 80))

  // 1. Zusammengeklebte Verben trennen: "Dübelentfernen" → "Dübel entfernen"
  t = t.replace(/([a-zäöüß])(entfernen|abbrechen|verlegen|montieren|schleifen|grundieren|streichen|spachteln|verfugen|ausmalen|demontieren|einbauen|liefern|verlegt|montiert)/gi,
    (_, p1, p2) => p1 + ' ' + p2.toLowerCase())

  // 2. Bekannte Whisper-Fehler korrigieren
  for (const [falsch, richtig] of Object.entries(KORREKTUREN)) {
    t = t.replace(new RegExp(falsch, 'gi'), richtig)
  }

  // 3. Verbliebene CamelCase-Verklebungen trennen: "DübelEntfernen" → "Dübel Entfernen"
  t = t.replace(/([a-zäöüß])([A-ZÄÖÜ])/g, '$1 $2')

  // 4. Doppelte Leerzeichen entfernen
  t = t.replace(/\s{2,}/g, ' ').trim()

  // 5. Einzahl → Mehrzahl bei Baubegriffen die im Kontext fast immer Mehrzahl sind
  isDev && console.log('MEHRZAHL CHECK - vor:', t.substring(0, 80))
  const mehrzahlKorrekturen = [
    [/\bSesselleiste\b(?!n)/gi, 'Sesselleisten'],
    [/\bSockelleiste\b(?!n)/gi, 'Sockelleisten'],
    [/\bWandfliese\b(?!n)/gi, 'Wandfliesen'],
    [/\bBodenfliese\b(?!n)/gi, 'Bodenfliesen'],
    [/\bFliese\b(?!n)/gi, 'Fliesen'],
    [/\bTürzarge\b(?!n)/gi, 'Türzargen'],
    [/\bSteckdose\b(?!n)/gi, 'Steckdosen'],
    [/\bLeitung\b(?!en)/gi, 'Leitungen'],
    [/\bFuge\b(?!n)/gi, 'Fugen'],
    [/\bSchraube\b(?!n)/gi, 'Schrauben'],
    [/\bDübel\b(?!n)/g, 'Dübeln'],
  ]
  for (const [regex, ersatz] of mehrzahlKorrekturen) {
    t = t.replace(regex, ersatz)
  }
  isDev && console.log('MEHRZAHL CHECK - nach:', t.substring(0, 80))

  isDev && console.log('KORRIGIERT:', t.substring(0, 80))

  return t
}

export function formatSpracheingabe(rawText) {
  if (!rawText || rawText.trim().length === 0) return rawText

  let text = rawText.trim()

  // 1. Normalisierungen
  text = text
    .replace(/quadratmeter/gi, 'm²')
    .replace(/laufmeter/gi, 'lfm')
    .replace(/(\d+)\s*m\s*2/gi, '$1 m²')
    .replace(/ca\s+(\d)/gi, 'ca. $1')
    .replace(/(\d+)\s*euro/gi, '$1 €')

  // 2. Definiere Trennwörter als Array (längere zuerst, damit sie Vorrang haben)
  const trennwoerter = [
    'nächste position',
    // Sprach-typische Übergänge
    'dann muss man',
    'dann müsste man',
    'dann kann man',
    'dann müsste',
    'dann muss',
    'dann kommt',
    'dann noch',
    'dann wird',
    'dann werden',
    'danach muss',
    'danach kommt',
    'danach wird',
    'vorher muss man',
    'vorher müsste man',
    'vorher muss',
    'vorher müsste',
    'davor muss',
    'anschließend',
    'zum schluss',
    'am ende',
    'als erstes',
    'als nächstes',
    // Formale Aufzählungswörter
    'inklusive',
    'sowie',
    'außerdem',
    'und außerdem',
    'weiters',
    'des weiteren',
    'darüber hinaus',
    'dazu kommt',
    'und dazu',
    'und noch',
    'dazu',
    'plus',
    'zusätzlich',
    'und dann',
  ]

  // 3. Ersetze Trennwörter durch ein Trennzeichen |||
  let prepared = text
  for (const wort of trennwoerter) {
    const regex = new RegExp(',?\\s*' + wort + '\\s+', 'gi')
    prepared = prepared.replace(regex, '|||')
  }

  // 3b. Komma-basierte Trennung bei Redefluss
  prepared = prepared.replace(/,\s*(dann|danach|vorher|davor|anschließend|zum Schluss)\s+/gi, '|||')

  // 4. Auch an Satzenden trennen (Punkt + Leerzeichen oder Punkt am Ende)
  prepared = prepared.replace(/\.\s+/g, '|||')
  prepared = prepared.replace(/\.$/, '')

  // 5. Splitten
  let parts = prepared.split('|||')
    .map(s => s.trim())
    .filter(s => s.length > 2)

  // 6. Bereinige jeden Teil
  parts = parts.map(part => {
    // Entferne Füllwörter und Sprachfluss-Einleitungen am Anfang
    part = part.replace(/^(also|ähm|äh|ja|und|dann|okay|na|und dann|man muss|muss man|müsste man|die müsste man|man müsste|das muss man|das sind ja so|und das sind ja|ich habe eine?|ich hab eine?|das ist ja|das ist)\s+/gi, '')
    // Ersten Buchstaben großschreiben
    part = part.charAt(0).toUpperCase() + part.slice(1)
    // Punkt am Ende entfernen
    part = part.replace(/\.$/, '').trim()
    return part
  }).filter(s => s.length > 2)

  isDev && console.log('FORMAT: Input:', rawText.substring(0, 80))
  isDev && console.log('FORMAT: Parts:', parts)

  // 7. Wenn nur 1 Teil: kein Bullet, einfach bereinigten Text zurückgeben
  if (parts.length <= 1) {
    const result = parts[0] || text
    isDev && console.log('FORMAT: Output (single):', result.substring(0, 80))
    return result
  }

  // 8. Mehrere Teile: als Bullet Points
  const result = parts.map(p => '• ' + p).join('\n')
  isDev && console.log('FORMAT: Output (bullets):', result.substring(0, 80))
  return result
}
