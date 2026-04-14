import { supabase, getEdgeFunctionHeaders } from './supabase.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const isDev = import.meta.env.DEV

export const MODEL = 'claude-sonnet-4-20250514'

export const GEWERKE_REIHENFOLGE = [
  'Gemeinkosten',
  'Abbruch',
  'Bautischler',
  'Glaser',
  'Elektriker',
  'Installateur',
  'Baumeister',
  'Trockenbau',
  'Maler',
  'Anstreicher',
  'Fliesenleger',
  'Bodenleger',
  'Elektrozuleitung',
  'Reinigung',
]

/**
 * Inserts a new position into the correct gewerk block.
 * If the gewerk already exists, appends; otherwise creates a new block
 * sorted by GEWERKE_REIHENFOLGE.
 */
export function insertPositionIntoGewerke(gewerke, newPos) {
  const targetName = newPos.gewerk || 'Allgemein'
  const existingIdx = gewerke.findIndex(
    g => g.name.toLowerCase() === targetName.toLowerCase()
  )
  let updated
  if (existingIdx >= 0) {
    updated = gewerke.map((g, i) =>
      i === existingIdx
        ? { ...g, positionen: [...(g.positionen || []), newPos] }
        : g
    )
  } else {
    const newGewerk = { name: targetName, positionen: [newPos], zwischensumme: 0 }
    updated = [...gewerke, newGewerk].sort((a, b) => {
      // Reinigung ALWAYS last
      const aRein = a.name.toLowerCase().includes('reinigung')
      const bRein = b.name.toLowerCase().includes('reinigung')
      if (aRein && !bRein) return 1
      if (!aRein && bRein) return -1

      const ai = GEWERKE_REIHENFOLGE.indexOf(a.name)
      const bi = GEWERKE_REIHENFOLGE.indexOf(b.name)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }
  return updated
}

/**
 * Sorts gewerke by their lowest leistungsnummer prefix in the catalog,
 * and positions within each gewerk: catalog positions first (by catalog order),
 * then KI-calculated positions (aus_preisliste !== true).
 */
export function sortGewerkeAndPositionen(gewerke, catalog) {
  if (!catalog || catalog.length === 0) return gewerke

  // gewerk name -> minimum numeric prefix (e.g. "Gemeinkosten" -> 1, "Abbruch" -> 2)
  const gewerkMinPrefix = new Map()
  for (const entry of catalog) {
    if (!entry.nr || !entry.gewerk) continue
    const prefix = parseInt(String(entry.nr).split('-')[0], 10)
    if (!isNaN(prefix)) {
      const cur = gewerkMinPrefix.get(entry.gewerk)
      if (cur === undefined || prefix < cur) gewerkMinPrefix.set(entry.gewerk, prefix)
    }
  }

  // leistungsnummer -> index in catalog (for position ordering)
  const catalogIndexMap = new Map()
  catalog.forEach((entry, idx) => {
    if (entry.nr) catalogIndexMap.set(String(entry.nr), idx)
  })

  const sorted = gewerke.map(gewerk => {
    const positionen = [...(gewerk.positionen || [])]
    positionen.sort((a, b) => {
      const aList = a.aus_preisliste === true
      const bList = b.aus_preisliste === true
      if (aList && !bList) return -1
      if (!aList && bList) return 1
      if (aList && bList) {
        const ai = catalogIndexMap.get(String(a.leistungsnummer)) ?? 999999
        const bi = catalogIndexMap.get(String(b.leistungsnummer)) ?? 999999
        return ai - bi
      }
      return 0
    })
    return { ...gewerk, positionen }
  })

  const norm = s => String(s || '').toLowerCase()

  sorted.sort((a, b) => {
    // Reinigung ALWAYS last – regardless of catalog prefix
    const aRein = norm(a.name).includes('reinigung')
    const bRein = norm(b.name).includes('reinigung')
    if (aRein && !bRein) return 1
    if (!aRein && bRein) return -1

    const ai = gewerkMinPrefix.get(a.name) ?? 9999
    const bi = gewerkMinPrefix.get(b.name) ?? 9999
    return ai - bi
  })

  return sorted
}

async function fetchWithRetry(requestBody, betaHeader = null, onRetry = null, timeoutMs = 0) {
  const MAX_RETRIES = 2
  const RETRY_WAIT_SEC = 90

  // Get user token for identity verification
  const { getFreshAccessToken } = await import('./supabase.js')
  let userToken = ''
  try { userToken = await getFreshAccessToken() } catch { /* logged out fallback */ }

  const controller = timeoutMs > 0 ? new AbortController() : null
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  // Add beta header to body if provided (proxy forwards it)
  const body = betaHeader
    ? { ...requestBody, anthropic_beta: betaHeader }
    : requestBody

  // Use Vercel API route (bypasses Supabase gateway JWT issue)
  // Falls back to Supabase edge function if Vercel route not available
  const apiUrl = '/api/claude-proxy'

  try {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const bodyStr = JSON.stringify(body)
    isDev && console.log('=== API CALL BODY ===', JSON.stringify({
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      tools: requestBody.tools || 'KEINE TOOLS',
      system_length: Array.isArray(requestBody.system)
        ? requestBody.system.reduce((n, b) => n + (b.text?.length || 0), 0)
        : (requestBody.system?.length || 0),
    }))
    isDev && console.log('WEB SEARCH AKTIV:', !!requestBody.tools)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': userToken,
      },
      body: bodyStr,
      signal: controller?.signal,
    })

    if (response.status === 529 && attempt < MAX_RETRIES) {
      isDev && console.log(`API Retry Versuch ${attempt + 1} nach Overloaded – warte 2s...`)
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      console.warn(`[Claude] 429 Rate Limit – Retry ${attempt + 1}/${MAX_RETRIES} in ${RETRY_WAIT_SEC}s`)
      for (let s = RETRY_WAIT_SEC; s > 0; s--) {
        onRetry?.(s)
        await new Promise(r => setTimeout(r, 1000))
      }
      onRetry?.(0)
      continue
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[Claude API] HTTP-Fehler →', err)
      if (response.status === 529) {
        throw new Error('API momentan überlastet, bitte in 30 Sekunden nochmal versuchen')
      }
      throw new Error(err.error?.message || `Claude API Fehler (HTTP ${response.status})`)
    }

    const data = await response.json()
    isDev && console.log('[Claude API] →', {
      stop_reason: data.stop_reason,
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
      cache_creation_input_tokens: data.usage?.cache_creation_input_tokens,
      cache_read_input_tokens: data.usage?.cache_read_input_tokens,
    })
    if (data.stop_reason === 'max_tokens') {
      console.warn('[Claude API] WARNUNG: Antwort wurde bei max_tokens abgeschnitten! Output-Tokens:', data.usage?.output_tokens)
      // Versuche die abgeschnittene Antwort trotzdem zu verwenden
      const textBlocks = data.content.filter(b => b.type === 'text')
      if (textBlocks.length > 0) {
        const partialText = textBlocks.map(b => b.text).join('\n')
        // Versuche abgeschnittenes JSON zu reparieren
        const repaired = repairTruncatedJson(partialText)
        if (repaired) {
          console.warn('[Claude API] Abgeschnittene Antwort wurde repariert und wird verwendet.')
          return repaired
        }
      }
      throw new Error('Die KI-Antwort wurde abgeschnitten (zu viele Tokens). Bitte kürze die Eingabe oder versuche es erneut.')
    }
    isDev && console.log('API Response Blocks:', data.content.map(b => b.type))
    const textBlocks = data.content.filter(b => b.type === 'text')
    if (textBlocks.length === 0) throw new Error('Keine Textantwort von der KI erhalten')
    return textBlocks.map(b => b.text).join('\n')
  }

  throw new Error('Die KI ist gerade ausgelastet. Bitte versuche es in einigen Minuten erneut.')
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function callClaude(systemPrompt, userMessage, onRetry = null, maxTokens = 32768) {
  const requestBody = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  }
  isDev && console.log('[Claude API] System-Prompt (callClaude):\n', systemPrompt)
  isDev && console.log('[Claude API] User-Message:\n', userMessage)
  const result = await fetchWithRetry(requestBody, null, onRetry)
  isDev && console.log('[Claude API] Rohe Antwort:\n', result)
  return result
}

/**
 * Wie callClaude, aber mit aktiviertem Web Search Tool.
 * Für Modus 1 (Leistung NEU) – sucht aktuelle Baupreise vor der Kalkulation.
 */
export async function callClaudeWithSearch(systemPrompt, userMessage, onRetry = null, maxTokens = 2000) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  const requestBody = {
    model: MODEL,
    max_tokens: maxTokens,
    tools,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  }
  isDev && console.log('API BODY hat tools:', JSON.stringify(requestBody).includes('web_search'))
  isDev && console.log('API BODY tools direkt:', JSON.stringify(requestBody.tools))
  isDev && console.log('[Claude API] System-Prompt (callClaudeWithSearch):\n', systemPrompt)
  isDev && console.log('[Claude API] User-Message:\n', userMessage)
  const result = await fetchWithRetry(
    requestBody,
    'web-search-2025-03-05',
    onRetry,
    60000,
  )
  isDev && console.log('[Claude API] Rohe Antwort:\n', result)
  return result
}

/**
 * Nachkalkulation: Positionen einzeln mit Modus-1-Prompt + Web-Search nachkalkulieren.
 *
 * Nachkalkuliert werden:
 * - Neue Positionen (aus_preisliste: false) → KI hat sie frei kalkuliert
 * - Katalog-Positionen mit 0€ Preis → Preis muss ermittelt werden
 *
 * NICHT nachkalkuliert werden:
 * - Katalog-Positionen mit echtem Preis (vk_netto_einheit > 0)
 * - Header (-000) und Spezial-Positionen (990-999: Regie/Material/Variable)
 */
export async function recalcNewPositionsWithModus1(gewerke, modus1Prompt, onRetry = null, onProgress = null) {
  const newPositions = []
  for (const g of gewerke) {
    for (const p of (g.positionen || [])) {
      const nr = String(p.leistungsnummer || '')
      // Header (-000) und Spezial-Positionen (990-999: Regie, Material, Variable) nie nachkalkulieren
      if (/[-–]\s*000$/.test(nr)) continue
      if (isSpecialPosition(nr)) continue
      // Katalog-Position MIT echtem Preis → nicht nachkalkulieren
      // (enrichFromCatalog setzt aus_preisliste: true auch für veraltete Katalog-Nummern,
      //  die in der DB fehlen – aber nur wenn der KI-Initialpreis > 0 ist)
      if (p.aus_preisliste === true && (p.vk_netto_einheit || 0) > 0) continue
      // 0€-Katalog-Positionen + echte Neue Positionen → nachkalkulieren
      newPositions.push({ gewerk: g.name, position: p })
    }
  }

  if (newPositions.length === 0) {
    console.log('[Modus1-Nachkalkulation] Keine neuen Positionen → übersprungen')
    return gewerke
  }

  console.log(`[Modus1-Nachkalkulation] ${newPositions.length} neue Position(en) werden nachkalkuliert...`)

  // Sequentiell nachkalkulieren (nicht parallel, um Rate-Limits zu vermeiden)
  const results = new Map()
  for (let i = 0; i < newPositions.length; i++) {
    const { gewerk: gewerkName, position: pos } = newPositions[i]
    const desc = `${pos.leistungsname || ''} – ${pos.beschreibung || ''} – Gewerk: ${gewerkName} – Menge: ${pos.menge || 1} ${pos.einheit || 'm²'}`

    if (onProgress) onProgress(i + 1, newPositions.length, pos.leistungsname)
    console.log(`[Modus1-Nachkalkulation] ${i + 1}/${newPositions.length}: ${pos.leistungsname}`)

    try {
      const response = await callClaudeWithSearch(modus1Prompt, `BESCHREIBUNG: ${desc}`, onRetry, 2000)
      let parsed = parseJsonResponse(response)
      if (parsed && !Array.isArray(parsed)) {
        parsed.leistungsname = cleanWebSearchTags(parsed.leistungsname)
        parsed.beschreibung = cleanWebSearchTags(parsed.beschreibung)
        results.set(pos, parsed)
      }
    } catch (err) {
      console.warn(`[Modus1-Nachkalkulation] Fehler bei "${pos.leistungsname}":`, err.message)
      // Bei Fehler: Original-Position beibehalten
    }
  }

  // Ergebnisse in die Gewerke einsetzen
  return gewerke.map(g => ({
    ...g,
    positionen: (g.positionen || []).map(p => {
      const recalced = results.get(p)
      if (!recalced) return p
      // Preisfelder aus Modus 1 übernehmen, Struktur-Infos beibehalten
      return {
        ...p,
        vk_netto_einheit: recalced.vk_netto_einheit ?? p.vk_netto_einheit,
        gesamtpreis: recalced.gesamtpreis ?? p.gesamtpreis,
        materialkosten_einheit: recalced.materialkosten_einheit ?? p.materialkosten_einheit,
        materialanteil_prozent: recalced.materialanteil_prozent ?? p.materialanteil_prozent,
        lohnkosten_minuten: recalced.lohnkosten_minuten ?? p.lohnkosten_minuten,
        lohnkosten_einheit: recalced.lohnkosten_einheit ?? p.lohnkosten_einheit,
        lohnanteil_prozent: recalced.lohnanteil_prozent ?? p.lohnanteil_prozent,
        stundensatz: recalced.stundensatz ?? p.stundensatz,
        // Texte aus Modus 2 beibehalten – Modus 1 liefert nur Preise.
        // Modus 2 hat bereits Raumbezeichnungen etc. im Text eingebaut.
        // Fallback auf Modus 1 nur wenn Modus 2 keinen Text hatte.
        beschreibung: p.beschreibung || recalced.beschreibung,
        leistungsname: p.leistungsname || recalced.leistungsname,
        _modus1_recalc: true,
      }
    }),
  }))
}

/**
 * Sendet einen API-Call mit gecachter System-Message (Prompt Caching).
 * cachedText (z.B. PREISLISTE) wird als zweiter System-Block mit
 * cache_control: ephemeral geschickt – zählt ab dem 2. Aufruf nicht
 * mehr zum Token-Verbrauch.
 */
export async function callClaudeWithCache(systemPrompt, cachedText, userMessage, onRetry = null) {
  const requestBody = {
    model: MODEL,
    max_tokens: 32768,
    system: [
      { type: 'text', text: systemPrompt },
      { type: 'text', text: cachedText, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  }
  isDev && console.log('[Claude API] System-Prompt (callClaudeWithCache):\n', systemPrompt)
  isDev && console.log('[Claude API] User-Message:\n', userMessage)
  const result = await fetchWithRetry(
    requestBody,
    'prompt-caching-2024-07-31',
    onRetry,
  )
  isDev && console.log('[Claude API] Rohe Antwort:\n', result)
  return result
}

/**
 * Skaliert ein Bild auf max. 2048×2048 px und komprimiert es als JPEG,
 * bis der base64-String unter maxSizeBytes bleibt (default 4 MB).
 * Gibt den reinen base64-String (ohne data-URL-Prefix) zurück.
 */
async function resizeImageToBase64(file, maxSizeBytes = 4194304) {
  const MAX_DIM = 2048
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = reject
    img.onload = () => {
      let { width, height } = img

      // Scale down to max dimensions
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Iteratively reduce quality until under maxSizeBytes
      let quality = 0.85
      let result = canvas.toDataURL('image/jpeg', quality).split(',')[1]

      while (result.length * 0.75 > maxSizeBytes && quality > 0.1) {
        quality = Math.max(0.1, quality - 0.1)
        result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      }

      // If still too large, halve dimensions and retry at quality 0.7
      if (result.length * 0.75 > maxSizeBytes) {
        canvas.width = Math.round(width / 2)
        canvas.height = Math.round(height / 2)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        result = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
      }

      resolve(result)
    }
    img.src = dataUrl
  })
}

/**
 * Wie callClaudeWithCache, aber mit Vision-Analyse von Fotos.
 * imageFiles = Array von { file: File, isVideo: boolean }
 * Es werden max. 5 Fotos (keine Videos) als base64-Blöcke übergeben.
 * Jedes Foto wird vor dem Senden auf max. 4 MB komprimiert.
 */
export async function callClaudeWithCacheAndImages(systemPrompt, cachedText, userMessage, imageFiles = [], onRetry = null, options = {}) {
  const { useWebSearch = false, maxTokens = 32768, timeoutMs = 0 } = options

  if (useWebSearch) {
    isDev && console.log('WEB SEARCH aktiviert für Modus:', maxTokens <= 4000 ? 'Kleines Angebot' : 'Großes Angebot')
  }

  // Nur Bilder (keine Videos), max. 5
  const photos = (imageFiles || [])
    .filter(f => !f.isVideo && f.file && f.file.type.startsWith('image/'))
    .slice(0, 5)

  // Content: erst Text, dann Bild-Blöcke
  const userContent = [{ type: 'text', text: userMessage }]

  for (const photo of photos) {
    const base64 = await resizeImageToBase64(photo.file)
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
    })
  }

  const requestBody = {
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: systemPrompt },
      { type: 'text', text: cachedText, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userContent }],
  }

  if (useWebSearch) {
    requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }

  const betaHeaders = ['prompt-caching-2024-07-31']
  if (useWebSearch) betaHeaders.push('web-search-2025-03-05')

  isDev && console.log('[Claude API] callClaudeWithCacheAndImages – Fotos:', photos.length)
  const result = await fetchWithRetry(
    requestBody,
    betaHeaders.join(','),
    onRetry,
    timeoutMs,
  )
  isDev && console.log('[Claude API] Rohe Antwort:\n', result)
  return result
}

const GEWERK_PREFIX_MAP = {
  'Gemeinkosten': '01', 'Abbruch': '02', 'Bautischler': '03', 'Glaser': '04',
  'Elektriker': '05', 'Installateur': '06', 'Baumeister': '07', 'Trockenbau': '08',
  'Maler': '09', 'Anstreicher': '10', 'Fliesenleger': '11', 'Bodenleger': '12',
  'Reinigung': '13', 'Elektrozuleitung': '16',
}

const VALID_LEISTUNGSNR = /^\d{2}-(\d{3,}|NEU\d*)$/
const CATALOG_NR_RE = /^\d{2}-\d{3,}$/

// Reverse map: prefix → gewerk name
const PREFIX_TO_GEWERK = Object.fromEntries(
  Object.entries(GEWERK_PREFIX_MAP).map(([name, prefix]) => [prefix, name])
)

// ─── Positions-Typ-Erkennung (990-999 Bereich) ──────────────────────────
// Die Nummern -997/-998/-999 sind NICHT fest zugeordnet!
// In manchen Gewerken ist -997 = Variable Pauschal, in anderen = Regiestunden.
// Erkennung MUSS über Name + Einheit laufen, nicht über die Nummer.

/**
 * Prüft ob eine Leistungsnummer im Spezial-Bereich liegt (990-999).
 * Alle Positionen in diesem Bereich (Regie, Material, Variable, Sonderrabatt)
 * sind Spezial-Positionen die nicht nachkalkuliert/dedupliziert werden.
 */
function isSpecialPosition(leistungsnummer) {
  const nr = String(leistungsnummer || '')
  const m = nr.match(/[-–](\d{3,})$/)
  if (!m) return false
  const suffix = parseInt(m[1])
  return suffix >= 990 && suffix <= 999
}

/**
 * Prüft ob eine Position eine Regiestunden-Position ist.
 * Erkennung über Name (enthält "Regie"/"regiestunden") UND Einheit (Std/Stunde).
 * Funktioniert unabhängig von der konkreten Nummer (-997, -998 etc.)
 */
function isRegiestundenPos(pos, catalogEntry) {
  const name = String(pos.leistungsname || catalogEntry?.name || '').toLowerCase()
  const einheit = String(pos.einheit || catalogEntry?.einheit || '').toLowerCase()
  const hasRegie = name.includes('regie')
  const hasStd = einheit.includes('std') || einheit.includes('stunde')
  return hasRegie && hasStd
}

/**
 * Prüft ob eine Position eine "Material für Regiestunden" Position ist.
 * Erkennung über Name (enthält "Material für" + "Regie").
 */
function isMaterialFuerRegiePos(pos, catalogEntry) {
  const name = String(pos.leistungsname || catalogEntry?.name || '').toLowerCase()
  const beschr = String(pos.beschreibung || catalogEntry?.beschreibung || '').toLowerCase()
  return (name.includes('material') && name.includes('regie')) ||
         (beschr.includes('material') && beschr.includes('regie'))
}

/**
 * Findet die "Material für Regiestunden"-Position im Katalog für ein Gewerk-Prefix.
 * Sucht im 990-999 Bereich nach einer Position deren Name "Material" + "Regie" enthält.
 */
function findMaterialFuerRegieInCatalog(catalog, gewerkPrefix) {
  return catalog.find(e => {
    const nr = String(e.nr || '')
    if (!nr.startsWith(gewerkPrefix + '-')) return false
    const m = nr.match(/[-–](\d{3,})$/)
    if (!m) return false
    const suffix = parseInt(m[1])
    if (suffix < 990 || suffix > 999) return false
    const name = String(e.name || '').toLowerCase()
    const beschr = String(e.beschreibung || '').toLowerCase()
    return (name.includes('material') && name.includes('regie')) ||
           (beschr.includes('material') && beschr.includes('regie'))
  })
}

/**
 * Korrigiert Positionen die von der KI dem falschen Gewerk zugeordnet wurden.
 * Maßstab ist ausschließlich das Nummern-Prefix der Leistungsnummer:
 * 02-910 → Abbruch, 13-001 → Reinigung, egal was die KI als gewerk-Feld gesetzt hat.
 * Positionen ohne gültiges Prefix bleiben im originalen Gewerk.
 */
export function fixGewerkeByLeistungsnummer(gewerke) {
  if (!gewerke || gewerke.length === 0) return gewerke

  // Collect all positions, route each to its correct gewerk by prefix
  const gewerkBuckets = {}  // name → { origGewerk, positionen[] }

  for (const gewerk of gewerke) {
    for (const pos of (gewerk.positionen || [])) {
      const nr = String(pos.leistungsnummer || '')
      const match = nr.match(/^(\d{2})-/)
      const correctName = match ? (PREFIX_TO_GEWERK[match[1]] || gewerk.name) : gewerk.name

      if (!gewerkBuckets[correctName]) {
        // Use the original gewerk object as template if names match, else create new
        const template = gewerke.find(g => g.name === correctName) || { name: correctName }
        gewerkBuckets[correctName] = { ...template, positionen: [] }
      }

      if (correctName !== gewerk.name) {
        isDev && console.log(`[fixGewerkeByLeistungsnummer] ${nr} "${pos.leistungsname}": ${gewerk.name} → ${correctName}`)
      }
      gewerkBuckets[correctName].positionen.push({ ...pos, gewerk: correctName })
    }
  }

  // Rebuild in original gewerk order, then append any newly created gewerke
  const result = []
  const seen = new Set()
  for (const gewerk of gewerke) {
    if (gewerkBuckets[gewerk.name] && !seen.has(gewerk.name)) {
      const g = gewerkBuckets[gewerk.name]
      result.push({ ...g, zwischensumme: g.positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0) })
      seen.add(gewerk.name)
    }
  }
  for (const [name, g] of Object.entries(gewerkBuckets)) {
    if (!seen.has(name)) {
      result.push({ ...g, zwischensumme: g.positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0) })
    }
  }
  // Remove empty gewerke
  return result.filter(g => (g.positionen || []).length > 0)
}

/**
 * Post-processes gewerke array: fixes leistungsnummern that don't match
 * the required format "XX-NNN" (catalog) or "XX-NEU[N]" (new positions).
 * Invalid formats like "M001" get replaced with proper gewerk-prefix-NEU numbers.
 */
export function fixGewerkeLeistungsnummern(gewerke) {
  return gewerke.map(gewerk => {
    const prefix = GEWERK_PREFIX_MAP[gewerk.name] || '00'
    let neuCounter = 0
    const positionen = (gewerk.positionen || []).map(pos => {
      if (VALID_LEISTUNGSNR.test(pos.leistungsnummer || '')) return pos
      const neuSuffix = neuCounter === 0 ? 'NEU' : `NEU${neuCounter}`
      neuCounter++
      return { ...pos, leistungsnummer: `${prefix}-${neuSuffix}`, aus_preisliste: false }
    })
    return { ...gewerk, positionen }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseDE(str) {
  return parseFloat(String(str || '').replace(/\./g, '').replace(',', '.')) || 0
}

/** Returns only the display portion of beschreibung (before "Berechnung:"). */
function trimBeschreibung(text) {
  if (!text) return ''
  const idx = text.indexOf('Berechnung:')
  return idx !== -1 ? text.substring(0, idx).trim() : text
}

/** True if this catalog entry has a "Berechnung:" formula in beschreibung (price irrelevant). */
function isFormulaEntry(entry) {
  return entry &&
    String(entry.beschreibung || '').includes('Berechnung:')
}

/**
 * Parses a STAFFELPREISE formula (after "Berechnung:") and returns the price
 * for the given totalNetto. Each rule is separated by newline or semicolon.
 *
 * Supported formats (German number style, e.g. "1.000" = 1000):
 *   "1-999 EUR = 135 EUR"
 *   "1.000-1.999 EUR = 185 EUR"
 *   "von 2.000 bis 9.999 EUR = 260 EUR"
 *   "10.000-39.999 EUR = 1,2% vom Umsatz (mind. 285 EUR)"
 *   "ab 100.000 EUR = 0,7% vom Umsatz (mind. 815 EUR)"
 */
function parseStaffelPreis(beschreibung, totalNetto, defaultPreis) {
  if (!beschreibung) return defaultPreis || 0

  // Extract formula section (after "Berechnung:")
  const berIdx = beschreibung.indexOf('Berechnung:')
  const formulaText = berIdx !== -1
    ? beschreibung.substring(berIdx + 'Berechnung:'.length)
    : beschreibung

  // Process rule by rule (split on ; or newline)
  const rules = formulaText.split(/[;\n]/).map(s => s.trim()).filter(Boolean)

  for (const rule of rules) {
    const r = rule.toLowerCase()

    // "ab X = Z [% ...] [(mind. M)]"
    const abM = r.match(/^ab\s+([\d.,]+)[^=]*=\s*([\d.,]+)\s*(%)?/)
    if (abM && totalNetto >= parseDE(abM[1])) {
      const val = parseDE(abM[2])
      const isPercent = !!abM[3]
      const mindM = r.match(/mind\.?\s*([\d.,]+)/)
      const minVal = mindM ? parseDE(mindM[1]) : 0
      return isPercent
        ? Math.max(minVal, Math.round(totalNetto * val / 100 * 100) / 100)
        : val
    }

    // "X-Y EUR = Z [% ...] [(mind. M)]"  or  "von X bis Y = Z ..."
    const rangeM = r.match(/([\d.,]+)\s*(?:–|-|bis)\s*([\d.,]+)[^=]*=\s*([\d.,]+)\s*(%)?/)
    if (rangeM) {
      const from = parseDE(rangeM[1])
      const to = parseDE(rangeM[2])
      if (totalNetto >= from && totalNetto <= to) {
        const val = parseDE(rangeM[3])
        const isPercent = !!rangeM[4]
        const mindM = r.match(/mind\.?\s*([\d.,]+)/)
        const minVal = mindM ? parseDE(mindM[1]) : 0
        return isPercent
          ? Math.max(minVal, Math.round(totalNetto * val / 100 * 100) / 100)
          : val
      }
    }
  }

  return defaultPreis || 0
}

/** Builds a fully calculated position from a catalog entry + computed price. */
function buildFormulaPosition(pos, entry, preis, stundensatz) {
  const menge = Number(pos.menge) || 1
  const minuten = Math.round(Number(entry.zeit_min || 0))
  const lohn = stundensatz > 0
    ? Math.min(Math.round((minuten / 60) * stundensatz * 100) / 100, preis)
    : 0
  const mat = Math.max(0, Math.round((preis - lohn) * 100) / 100)
  const gesamtpreis = Math.round(menge * preis * 100) / 100
  const materialProzent = preis > 0 ? Math.round((mat / preis) * 1000) / 10 : 0
  const lohnProzent = preis > 0 ? Math.round((100 - materialProzent) * 10) / 10 : 0
  return {
    ...pos,
    leistungsnummer: entry.nr,
    leistungsname: entry.name,
    // Keep AI-generated beschreibung (may contain room names) – fall back to catalog
    beschreibung: pos.beschreibung || trimBeschreibung(entry.beschreibung) || '',
    einheit: entry.einheit || pos.einheit,
    vk_netto_einheit: preis,
    materialkosten_einheit: mat,
    lohnkosten_einheit: lohn,
    lohnkosten_minuten: minuten,
    stundensatz,
    menge,
    gesamtpreis,
    materialanteil_prozent: materialProzent,
    lohnanteil_prozent: lohnProzent,
    aus_preisliste: true,
  }
}

// ─── enrichFromCatalog ────────────────────────────────────────────────────

/**
 * After AI response: for positions with a valid catalog leistungsnummer (XX-NNN),
 * replaces price/name/description with actual catalog data. Keeps menge from AI.
 * Formula positions (preis=0 + "Berechnung:") are skipped here — handled later
 * by applyBaustelleneinrichtung. Beschreibung is trimmed at "Berechnung:".
 */
// Prüft ob KI-Einheit mit Katalog-Einheit kompatibel ist.
// "pauschal" ist nur mit "pauschal" kompatibel, "lfm" nur mit "lfm"/"m", etc.
function einheitenKompatibel(aiEinheit, catalogEinheit) {
  if (!aiEinheit || !catalogEinheit) return true // im Zweifel kompatibel
  const a = String(aiEinheit).toLowerCase().trim()
  const c = String(catalogEinheit).toLowerCase().trim()
  if (a === c) return true
  // Normalisiere gängige Varianten
  const norm = s => s
    .replace(/laufmeter|lfdm|lfm\.?|m'|meter/g, 'lfm')
    .replace(/quadratmeter|qm/g, 'm²')
    .replace(/stück|stk\.?/g, 'stk')
    .replace(/pausch\.?|psch\.?/g, 'pauschal')
    .replace(/paar/g, 'paar')
  return norm(a) === norm(c)
}

export function enrichFromCatalog(gewerke, catalog, stundensaetze) {
  if (!catalog || catalog.length === 0) return gewerke
  const catalogMap = new Map(catalog.map(p => [String(p.nr), p]))

  return gewerke.map(gewerk => {
    const stundensatz = Number(stundensaetze?.[gewerk.name] || 0)
    const positionen = (gewerk.positionen || []).map(pos => {
      const nr = String(pos.leistungsnummer || '')
      if (!CATALOG_NR_RE.test(nr)) return pos
      const entry = catalogMap.get(nr)
      if (!entry) {
        // Leistungsnummer im Katalog-Format (XX-NNN), aber nicht in der geladenen Katalog-DB.
        // Grund: Katalog in der App ist veraltet (Position wurde in HERO nach dem letzten
        // Export angelegt). → als Katalog-Position markieren damit Nachkalkulation sie überspringt.
        // Der Preis bleibt der KI-Initialwert – Benutzer kann manuell korrigieren.
        return { ...pos, aus_preisliste: true }
      }
      if (isFormulaEntry(entry)) return pos  // handled by applyBaustelleneinrichtung

      // Einheiten-Check: Wenn KI eine spezifische Einheit gesetzt hat die nicht
      // zum Katalog passt (z.B. KI: "lfm", Katalog: "pauschal"), Katalog-Anreicherung
      // überspringen – Position wird als Neu-Kalkulation behandelt
      if (pos.einheit && entry.einheit && !einheitenKompatibel(pos.einheit, entry.einheit)) {
        console.log(`KATALOG-SKIP: ${nr} – KI-Einheit "${pos.einheit}" ≠ Katalog "${entry.einheit}"`)
        return { ...pos, aus_preisliste: false }
      }

      // Material für Regiestunden: Preis wird von applyRegieMaterial berechnet
      if (isMaterialFuerRegiePos(pos, entry)) {
        return {
          ...pos,
          leistungsname: entry.name,
          beschreibung: pos.beschreibung || trimBeschreibung(entry.beschreibung) || '',
          einheit: entry.einheit || pos.einheit,
          aus_preisliste: true,
        }
      }

      // Template-Positionen (Katalogpreis 0€, z.B. 02-001/09-001 Abdeckarbeiten):
      // Katalog-Name + Einheit übernehmen, aber KI-Preise NICHT mit 0€ überschreiben.
      // aus_preisliste: false → Modus-1-Nachkalkulation kalkuliert per Web-Search.
      if ((Number(entry.preis) || 0) <= 0) {
        console.log(`[enrichFromCatalog] Template-Position ${nr}: Katalogpreis 0€ → KI-Preis beibehalten, Nachkalkulation triggered`)
        return {
          ...pos,
          leistungsname: entry.name,
          beschreibung: pos.beschreibung || trimBeschreibung(entry.beschreibung) || '',
          einheit: entry.einheit || pos.einheit,
          aus_preisliste: false, // → triggers Modus-1-Nachkalkulation
        }
      }

      const menge = Number(pos.menge) || 1
      const vk = Math.round(Number(entry.preis || 0) * 100) / 100
      const minuten = Math.round(Number(entry.zeit_min || 0))
      const lohnCalc = stundensatz > 0 ? Math.round((minuten / 60) * stundensatz * 100) / 100 : 0
      const lohn = Math.min(lohnCalc, vk)
      const mat = Math.max(0, Math.round((vk - lohn) * 100) / 100)
      const gesamtpreis = Math.round(menge * vk * 100) / 100
      const materialProzent = vk > 0 ? Math.round((mat / vk) * 1000) / 10 : 0
      const lohnProzent = vk > 0 ? Math.round((100 - materialProzent) * 10) / 10 : 0

      return {
        ...pos,
        leistungsname: entry.name,
        // Keep AI-generated beschreibung (may contain room names) – fall back to catalog
    beschreibung: pos.beschreibung || trimBeschreibung(entry.beschreibung) || '',
        einheit: entry.einheit || pos.einheit,
        vk_netto_einheit: vk,
        materialkosten_einheit: mat,
        lohnkosten_einheit: lohn,
        lohnkosten_minuten: minuten,
        stundensatz,
        menge,
        gesamtpreis,
        materialanteil_prozent: materialProzent,
        lohnanteil_prozent: lohnProzent,
        aus_preisliste: true,
      }
    })
    return { ...gewerk, positionen }
  })
}

// ─── Regiestunden Safety Net ──────────────────────────────────────────────

/**
 * Safety Net: Wenn eine Regiestunden-Position existiert, aber keine zugehörige
 * "Material für Regiestunden"-Position danach kommt, wird sie automatisch
 * aus dem Katalog eingefügt.
 *
 * WICHTIG: Erkennung über Name + Einheit, NICHT über hardcodierte Nummern!
 * Die Nummern im 990-999 Bereich variieren je nach Gewerk:
 *   - In manchen Gewerken ist -997 = Variable, -998 = Regie
 *   - In anderen ist -997 = Regie, -998 = Regie (2. Typ)
 * Die "Material für Regie"-Position wird im Katalog per Name gesucht.
 *
 * Muss VOR applyRegieMaterial aufgerufen werden.
 */
export function ensureRegieMaterial(gewerke, catalog) {
  if (!catalog || catalog.length === 0) return gewerke
  const catalogMap = new Map(catalog.map(p => [String(p.nr), p]))

  let changed = false
  const newGewerke = gewerke.map(gewerk => {
    const positionen = gewerk.positionen || []
    const newPositionen = []

    for (let i = 0; i < positionen.length; i++) {
      const pos = positionen[i]
      const nr = String(pos.leistungsnummer || '')
      const catalogEntry = catalogMap.get(nr) || null
      newPositionen.push(pos)

      // Prüfen ob das eine Regiestunden-Position ist (Name + Einheit)
      if (!isRegiestundenPos(pos, catalogEntry)) continue

      // Gewerk-Prefix extrahieren (z.B. "09" aus "09-998")
      const prefixMatch = nr.match(/^(\d{2})/)
      if (!prefixMatch) continue
      const prefix = prefixMatch[1]

      // Prüfen ob die nächste Position bereits eine Material-für-Regie-Position ist
      const nextPos = positionen[i + 1]
      if (nextPos) {
        const nextCatalog = catalogMap.get(String(nextPos.leistungsnummer || '')) || null
        if (isMaterialFuerRegiePos(nextPos, nextCatalog)) continue // Material existiert bereits
      }

      // Material-Position fehlt → im Katalog suchen und einfügen
      const materialEntry = findMaterialFuerRegieInCatalog(catalog, prefix)
      if (!materialEntry) {
        console.log(`[ensureRegieMaterial] Kein "Material für Regie" im Katalog für Prefix ${prefix}`)
        continue
      }

      changed = true
      const materialNr = String(materialEntry.nr)
      console.log(`[ensureRegieMaterial] ${materialNr}: Automatisch nach ${nr} eingefügt (erkannt über Name)`)
      newPositionen.push({
        leistungsnummer: materialNr,
        leistungsname: materialEntry.name || `Material für Regiestunden`,
        beschreibung: trimBeschreibung(materialEntry.beschreibung) || '',
        einheit: materialEntry.einheit || 'pauschal',
        menge: 1,
        vk_netto_einheit: 0,
        gesamtpreis: 0,
        materialkosten_einheit: 0,
        lohnkosten_einheit: 0,
        lohnkosten_minuten: 0,
        stundensatz: 0,
        materialanteil_prozent: 100,
        lohnanteil_prozent: 0,
        aus_preisliste: true,
      })
    }

    if (newPositionen.length === positionen.length) return gewerk
    const zwischensumme = Math.round(newPositionen.reduce((s, p) => s + (Number(p.gesamtpreis) || 0), 0) * 100) / 100
    return { ...gewerk, positionen: newPositionen, zwischensumme }
  })

  return changed ? newGewerke : gewerke
}

// ─── Regiestunden Material-Preis ──────────────────────────────────────────

/**
 * Berechnet den Preis für "Material für Position Regiestunden".
 * Der Prozentsatz steht im Katalog-Eintrag (beschreibung/name, z.B. "10%").
 * Preis = Gesamtpreis der vorherigen Regiestunden-Position × Prozentsatz.
 *
 * WICHTIG: Erkennung über Name (enthält "Material" + "Regie"), nicht über
 * hardcodierte Nummern. Die vorherige Regie-Position wird ebenfalls per
 * Name + Einheit erkannt.
 */
export function applyRegieMaterial(gewerke, catalog) {
  if (!catalog || catalog.length === 0) return gewerke
  const catalogMap = new Map(catalog.map(p => [String(p.nr), p]))

  let changed = false
  const newGewerke = gewerke.map(gewerk => {
    const positionen = gewerk.positionen || []
    let posChanged = false

    const newPositionen = positionen.map((pos, idx) => {
      const nr = String(pos.leistungsnummer || '')
      const catalogEntry = catalogMap.get(nr) || null

      // Prüfung per Name statt Nummer
      if (!isMaterialFuerRegiePos(pos, catalogEntry)) return pos

      // Prozentsatz aus Katalog-Beschreibung/Name extrahieren (z.B. "10%" oder "30%")
      const searchText = (catalogEntry?.beschreibung || '') + ' ' + (catalogEntry?.name || '') + ' ' + (pos.leistungsname || '') + ' ' + (pos.beschreibung || '')
      const pctMatch = searchText.match(/(\d+)\s*%/)
      if (!pctMatch) {
        console.log(`[applyRegieMaterial] ${nr}: Kein Prozentsatz gefunden in "${searchText}"`)
        return pos
      }
      const prozent = Number(pctMatch[1])

      // Vorherige Position finden (sollte die Regiestunden-Position sein)
      let regieGesamt = 0
      for (let i = idx - 1; i >= 0; i--) {
        const prevNr = String(positionen[i].leistungsnummer || '')
        const prevCatalog = catalogMap.get(prevNr) || null
        if (isRegiestundenPos(positionen[i], prevCatalog)) {
          regieGesamt = Number(positionen[i].gesamtpreis) || 0
          break
        }
      }

      if (regieGesamt <= 0) {
        console.log(`[applyRegieMaterial] ${nr}: Keine Regiestunden-Position davor gefunden`)
        return pos
      }

      const materialPreis = Math.round(regieGesamt * prozent / 100 * 100) / 100
      posChanged = changed = true
      console.log(`[applyRegieMaterial] ${nr}: ${regieGesamt} × ${prozent}% = ${materialPreis}`)

      return {
        ...pos,
        vk_netto_einheit: materialPreis,
        gesamtpreis: materialPreis,
        materialkosten_einheit: materialPreis,
        lohnkosten_einheit: 0,
        lohnkosten_minuten: 0,
        materialanteil_prozent: 100,
        lohnanteil_prozent: 0,
        menge: 1,
      }
    })

    if (!posChanged) return gewerk
    const zwischensumme = Math.round(newPositionen.reduce((s, p) => s + (Number(p.gesamtpreis) || 0), 0) * 100) / 100
    return { ...gewerk, positionen: newPositionen, zwischensumme }
  })

  return changed ? newGewerke : gewerke
}

// ─── Formula price application ────────────────────────────────────────────

/**
 * Handles generic formula positions (NOT 01-001/01-002 – those are handled by
 * recalcBaustelleneinrichtung). totalNetto excludes only 01-001/01-002, never
 * other positions, so formula positions with real prices are counted correctly.
 */
export function applyBaustelleneinrichtung(gewerke, catalog, stundensaetze) {
  if (!catalog || catalog.length === 0) return gewerke
  const catalogMap = new Map(catalog.map(p => [String(p.nr), p]))

  // totalNetto: exclude ONLY 01-001 and 01-002 – NOT all formula positions
  let totalNetto = 0
  gewerke.forEach(g => {
    ;(g.positionen || []).forEach(p => {
      const nr = String(p.leistungsnummer || '')
      if (nr === '01-001' || nr === '01-002') return
      totalNetto += Number(p.gesamtpreis || 0)
    })
  })

  let changed = false
  const newGewerke = gewerke.map(gewerk => {
    const stundensatz = Number(stundensaetze?.[gewerk.name] || 0)
    let posChanged = false

    const positionen = (gewerk.positionen || []).map(pos => {
      const nr = String(pos.leistungsnummer || '')
      if (nr === '01-001' || nr === '01-002') return pos // handled by recalcBaustelleneinrichtung

      const entry = catalogMap.get(nr)
      if (entry && isFormulaEntry(entry)) {
        const preis = parseStaffelPreis(entry.beschreibung, totalNetto, 0)
        if (preis === 0) return pos
        posChanged = changed = true
        return buildFormulaPosition(pos, entry, preis, stundensatz)
      }

      return pos
    })

    if (!posChanged) return gewerk
    const zwischensumme = positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0)
    return { ...gewerk, positionen, zwischensumme }
  })

  return changed ? newGewerke : gewerke
}

/**
 * Recalculates Baustelleneinrichtung (01-001 / 01-002) AFTER all other positions
 * are finalised. Always uses the sum of all NON-BE positions as the basis.
 *
 * Logic:
 *  1. Sum all positions except 01-001 / 01-002.
 *  2. Parse staffeln from 01-002 catalog description.
 *  3. If sum falls in a 01-002 range → use 01-002.
 *  4. Otherwise → use 01-001 (parse its staffeln, apply % or flat price).
 *  5. Replace the BE position in-place with pure lump-sum values (lohn/mat = 0).
 */
export function recalcBaustelleneinrichtung(gewerke, catalog) {
  console.log('>>> recalcBaustelleneinrichtung AUFGERUFEN')
  if (!catalog || catalog.length === 0) {
    console.warn('>>> recalcBaustelleneinrichtung: Kein Katalog – Abbruch')
    return gewerke
  }

  // ── Schritt 1: Summe OHNE 01-001 und 01-002 ────────────────────────────
  let summeOhneBE = 0
  for (const gewerk of gewerke) {
    for (const pos of (gewerk.positionen || [])) {
      const nr = String(pos.leistungsnummer || '')
      if (nr !== '01-001' && nr !== '01-002') {
        summeOhneBE += Number(pos.gesamtpreis) || 0
      }
    }
  }

  // ── Schritt 2: Einträge aus Katalog ────────────────────────────────────
  // parseExcel saves with lowercase keys: nr, name, beschreibung, einheit, preis
  const pos002 = catalog.find(p => String(p.nr) === '01-002')
  const pos001 = catalog.find(p => String(p.nr) === '01-001')

  console.log('DEBUG BE: Katalog-Keys =', catalog.length > 0 ? Object.keys(catalog[0]) : '(leer)')
  console.log('DEBUG BE: pos001 gefunden =', !!pos001, pos001)
  console.log('DEBUG BE: pos002 gefunden =', !!pos002, pos002)
  console.log('DEBUG BE: summeOhneBE =', summeOhneBE)

  const beschreibung002 = String(pos002?.beschreibung || '')
  const beschreibung001 = String(pos001?.beschreibung || '')

  // ── Schritt 3: Staffeln aus Beschreibungstext parsen ───────────────────
  function parseStaffeln(rawText) {
    const staffeln = []

    // Extrahiere den Teil nach "Berechnung:"
    const berIdx = rawText.indexOf('Berechnung:')
    const raw = berIdx !== -1 ? rawText.substring(berIdx + 'Berechnung:'.length) : rawText

    // Normalisiere: \xa0 → Leerzeichen, mehrfache Spaces reduzieren
    let text = raw.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ')
    console.log('DEBUG parseStaffeln input:', text)

    // Trenne am "von"-Keyword (jedes "von" beginnt eine neue Staffel)
    const parts = text.split(/(?=von\s)/gi)

    for (const part of parts) {
      const p = part.trim()
      if (!p) continue
      console.log('DEBUG Staffel-Part:', p)

      // Prozent-Staffel: "von X € bis Y € = Z% vom Umsatz, mindestens M €"
      const prozentMatch = p.match(
        /von\s+([\d.,]+)\s*€?\s*bis\s+([\d.,]+)\s*€?\s*=\s*([\d.,]+)\s*%\s*vom\s+Umsatz[,\s]*mindestens\s+([\d.,]+)\s*€/i
      )
      if (prozentMatch) {
        const von = parseDE(prozentMatch[1])
        const bis = parseDE(prozentMatch[2])
        const prozent = parseDE(prozentMatch[3])
        const mindestens = parseDE(prozentMatch[4])
        staffeln.push({ von, bis, val: prozent, isPercent: true, mindestens })
        console.log('DEBUG Prozent-Staffel:', { von, bis, prozent, mindestens })
        continue
      }

      // Fixpreis-Staffel: "von X € bis Y € = Z €"
      const fixMatch = p.match(
        /von\s+([\d.,]+)\s*€?\s*bis\s+([\d.,]+)\s*€?\s*=\s*([\d.,]+)\s*€/i
      )
      if (fixMatch) {
        const von = parseDE(fixMatch[1])
        const bis = parseDE(fixMatch[2])
        const preis = parseDE(fixMatch[3])
        staffeln.push({ von, bis, val: preis, isPercent: false, mindestens: 0 })
        console.log('DEBUG Fix-Staffel:', { von, bis, preis })
      }
    }

    return staffeln
  }

  function calcPreis(staffeln, summe) {
    const treffer = staffeln.find(s => summe >= s.von && summe <= s.bis)
    if (!treffer) return 0
    if (treffer.isPercent) {
      return Math.max(treffer.mindestens, Math.round(summe * treffer.val / 100 * 100) / 100)
    }
    return treffer.val
  }

  const staffeln002 = parseStaffeln(beschreibung002)
  const staffeln001 = parseStaffeln(beschreibung001)

  console.log('DEBUG BE Staffeln 01-002:', JSON.stringify(staffeln002))
  console.log('DEBUG BE Staffeln 01-001:', JSON.stringify(staffeln001))

  // ── Schritt 4: Welche Position verwenden? ──────────────────────────────
  // Unter 3.000 € → 01-002 (Kleinbaustelleneinrichtung), ab 3.000 € → 01-001
  const useKlein = summeOhneBE < 3000
  let verwendeNr, bePreis, beEntry

  if (useKlein && pos002) {
    verwendeNr = '01-002'
    bePreis = calcPreis(staffeln002, summeOhneBE)
    beEntry = pos002
    // Fallback: falls keine Staffel trifft, versuche 01-001
    if (bePreis === 0) {
      verwendeNr = '01-001'
      bePreis = calcPreis(staffeln001, summeOhneBE)
      beEntry = pos001
    }
  } else {
    verwendeNr = '01-001'
    bePreis = calcPreis(staffeln001, summeOhneBE)
    beEntry = pos001
    // Fallback: falls keine Staffel trifft, versuche 01-002
    if (bePreis === 0 && pos002) {
      verwendeNr = '01-002'
      bePreis = calcPreis(staffeln002, summeOhneBE)
      beEntry = pos002
    }
  }

  console.log('DEBUG BE ERGEBNIS: verwendePos=', verwendeNr, 'bePreis=', bePreis, 'summeOhneBE=', summeOhneBE)

  if (!beEntry || bePreis === 0) {
    console.warn('DEBUG BE: Kein Staffel-Treffer – keine Änderung')
    return gewerke
  }

  const beLangtext = trimBeschreibung(beEntry.beschreibung || '')

  // ── Schritt 5: Position in Gewerken ersetzen ───────────────────────────
  return gewerke.map(gewerk => {
    const hasBE = (gewerk.positionen || []).some(p => {
      const nr = String(p.leistungsnummer || '')
      return nr === '01-001' || nr === '01-002'
    })
    if (!hasBE) return gewerk

    const positionen = gewerk.positionen.map(pos => {
      const nr = String(pos.leistungsnummer || '')
      if (nr !== '01-001' && nr !== '01-002') return pos
      return {
        ...pos,
        leistungsnummer: verwendeNr,
        leistungsname: beEntry.name || pos.leistungsname,
        beschreibung: beLangtext || pos.beschreibung,
        menge: 1,
        einheit: beEntry.einheit || 'pauschal',
        vk_netto_einheit: bePreis,
        gesamtpreis: bePreis,
        materialkosten_einheit: 0,
        materialanteil_prozent: 0,
        lohnkosten_einheit: 0,
        lohnkosten_minuten: 0,
        stundensatz: 0,
        lohnanteil_prozent: 0,
        aus_preisliste: true,
      }
    })
    const zwischensumme = positionen.reduce((s, p) => s + (p.gesamtpreis || 0), 0)
    return { ...gewerk, positionen, zwischensumme }
  })
}

/**
 * Entfernt <cite>-Tags und andere HTML-Tags aus Web-Search-Antworten.
 * Muss auf leistungsname und beschreibung jeder Position angewendet werden.
 */
export function cleanWebSearchTags(text) {
  if (!text) return text
  text = text.replace(/<cite[^>]*>/gi, '')
  text = text.replace(/<\/cite>/gi, '')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/\s{2,}/g, ' ')
  return text.trim()
}

/**
 * Versucht abgeschnittenes JSON zu reparieren, indem offene Klammern geschlossen werden.
 * Gibt den reparierten String zurück oder null wenn nicht reparierbar.
 */
function repairTruncatedJson(text) {
  if (!text) return null
  // Finde den JSON-Anfang
  const jsonStart = text.indexOf('{')
  if (jsonStart === -1) return null
  let json = text.slice(jsonStart)
  // Versuche zuerst ob es schon gültiges JSON ist
  try { JSON.parse(json); return text } catch (e) { /* weiter */ }
  // Entferne den letzten unvollständigen Wert (abgeschnittener String, Zahl etc.)
  // Schneide beim letzten vollständigen Objekt/Array-Element ab
  const lastComplete = Math.max(
    json.lastIndexOf('},'),
    json.lastIndexOf('}]'),
    json.lastIndexOf('" ,'),
    json.lastIndexOf('",'),
    json.lastIndexOf('],' ),
  )
  if (lastComplete > 0) {
    json = json.slice(0, lastComplete + 1)
  }
  // Zähle offene/geschlossene Klammern
  let openBraces = 0, openBrackets = 0
  let inString = false, escaped = false
  for (const ch of json) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') openBraces++
    if (ch === '}') openBraces--
    if (ch === '[') openBrackets++
    if (ch === ']') openBrackets--
  }
  // Schließe offene Klammern
  for (let i = 0; i < openBrackets; i++) json += ']'
  for (let i = 0; i < openBraces; i++) json += '}'
  try {
    JSON.parse(json)
    console.warn('[repairTruncatedJson] JSON erfolgreich repariert')
    // Gib den originalen Text mit repariertem JSON zurück
    return text.slice(0, jsonStart) + json
  } catch (e) {
    console.error('[repairTruncatedJson] Reparatur fehlgeschlagen:', e.message)
    return null
  }
}

export function parseJsonResponse(rawText) {
  console.log('[Claude API] Rohe KI-Antwort:', rawText)

  // Build list of candidate strings to try in order
  const candidates = []

  // Candidate 1: raw text trimmed
  candidates.push((rawText || '').trim())

  // Candidate 2: extract content from markdown code block
  const mdMatch = (rawText || '').match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdMatch) candidates.push(mdMatch[1].trim())

  // Candidate 3: strip markdown fences, then trim to first { … last }
  const stripped = (rawText || '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  const firstBrace = stripped.indexOf('{')
  const lastBrace = stripped.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(stripped.substring(firstBrace, lastBrace + 1))
  }

  // Candidate 4: regex – grab the first complete {...} block
  const jsonMatch = (rawText || '').match(/\{[\s\S]*\}/)
  if (jsonMatch) candidates.push(jsonMatch[0])

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      console.log('[Claude API] JSON parsed →', parsed)
      return parsed
    } catch (_) {
      // try next candidate
    }
  }

  // All strategies failed
  console.error('[Claude API] Alle JSON-Parse-Versuche fehlgeschlagen. Roher Text:', rawText)
  const err = new Error('Das Angebot konnte nicht erstellt werden. Bitte versuche es erneut.')
  err.isParseError = true
  throw err
}

/**
 * Validates and corrects a single position after KI response.
 * Enforces consistency in this exact order:
 * 1. vk_netto_einheit and materialkosten_einheit from AI (trusted)
 * 2. lohnkosten_einheit = vk_netto_einheit - materialkosten_einheit
 * 3. lohnkosten_minuten = round(lohnkosten_einheit / stundensatz * 60) → whole minutes
 * 4. lohnkosten_einheit recalculated from rounded minutes = (minuten / 60) * stundensatz
 * 5. vk_netto_einheit = lohnkosten_einheit + materialkosten_einheit (adjusted after rounding)
 * 6. gesamtpreis = menge * vk_netto_einheit
 * 7. materialanteil_prozent and lohnanteil_prozent (sum exactly 100%)
 */
export function fixPositionKosten(pos) {
  if (!pos || typeof pos !== 'object' || pos.deleted) return pos

  const mat = Math.round((Number(pos.materialkosten_einheit) || 0) * 100) / 100
  const stundensatz = Number(pos.stundensatz) || 0
  const menge = Number(pos.menge) || 0

  // Step 2: lohn from vk - material
  const vkRaw = Math.round((Number(pos.vk_netto_einheit) || 0) * 100) / 100
  const lohnRaw = Math.round((vkRaw - mat) * 100) / 100

  // Step 3: back-calculate minutes to whole number
  const minuten = stundensatz > 0
    ? Math.round((lohnRaw / stundensatz) * 60)
    : Math.round(Number(pos.lohnkosten_minuten) || 0)

  // Step 4: recalculate lohn from rounded minutes
  const lohn = stundensatz > 0
    ? Math.round((minuten / 60) * stundensatz * 100) / 100
    : lohnRaw

  // Step 5: vk adjusted after minute rounding
  let vk = Math.round((lohn + mat) * 100) / 100

  // Step 5b: Wenn vkRaw ein glatter Wert war (vom User direkt gesetzt) und die
  // Minuten-Rundung nur einen kleinen Drift erzeugt hat (< 0.05 €), VK auf den
  // ursprünglichen Wert snappen und lohn als Restbetrag berechnen.
  // Verhindert 599.99 statt 600.00 bei direkter Preisänderung.
  if (Math.abs(vk - vkRaw) < 0.05 && Math.abs(vkRaw - Math.round(vkRaw)) < 0.005) {
    vk = Math.round(vkRaw * 100) / 100
  }

  // Step 5c: lohn exakt als Differenz (vk - mat), damit mat + lohn = vk IMMER stimmt
  const lohnFinal = Math.round((vk - mat) * 100) / 100

  // Step 6: gesamtpreis
  const gesamtpreis = menge > 0
    ? Math.round(menge * vk * 100) / 100
    : Math.round((Number(pos.gesamtpreis) || 0) * 100) / 100

  // Step 7: percentages (sum exactly 100%)
  const materialProzent = vk > 0 ? Math.round((mat / vk) * 1000) / 10 : 0
  const lohnProzent = vk > 0 ? Math.round((100 - materialProzent) * 10) / 10 : 0

  return {
    ...pos,
    vk_netto_einheit: vk,
    materialkosten_einheit: mat,
    lohnkosten_einheit: lohnFinal,
    lohnkosten_minuten: minuten,
    gesamtpreis,
    materialanteil_prozent: materialProzent,
    lohnanteil_prozent: lohnProzent,
  }
}

/**
 * Überschreibt KI-Zeitangabe wenn der User im Text eine konkrete Stundenanzahl nennt.
 * Wird NACH fixPositionKosten aufgerufen – User-Angabe hat immer Vorrang.
 */
export function enforceUserZeitangabe(pos, userText, stundensaetze = {}) {
  if (!pos || typeof pos !== 'object' || pos.deleted) return pos

  const ZEIT_PATTERNS = [
    /(?:^|\s)(\d+[\.,]?\d*)\s*(?:stunden?|std\.?|hours?|h)\b/i,
    /ca\.?\s*(\d+[\.,]?\d*)\s*(?:stunden?|std\.?|hours?|h)\b/i,
    /ungef(?:ä|ae)hr\s*(\d+[\.,]?\d*)\s*(?:stunden?|std\.?|hours?|h)\b/i,
    /dauert\s*(?:ca\.?\s*)?(\d+[\.,]?\d*)\s*(?:stunden?|std\.?|hours?|h)\b/i,
    /arbeitszeit\s*(?:ca\.?\s*)?(\d+[\.,]?\d*)\s*(?:stunden?|std\.?|hours?|h)\b/i,
  ]

  let userStunden = null
  for (const re of ZEIT_PATTERNS) {
    const m = String(userText || '').match(re)
    if (m) { userStunden = parseFloat(String(m[1]).replace(',', '.')); break }
  }
  if (!userStunden || userStunden <= 0) return pos

  const userMinuten = Math.round(userStunden * 60)
  const kiMinuten = Number(pos.lohnkosten_minuten) || 0

  // Stundensatz: aus Position, dann aus Gewerk-Stammdaten, dann Fallback 70
  const gewerk = String(pos.gewerk || '')
  const stundensatz = Number(pos.stundensatz) || Number(stundensaetze?.[gewerk]) || 70

  const lohn = Math.round((userMinuten / 60) * stundensatz * 100) / 100

  // Material beibehalten, aber maximal 30% vom neuen VK
  let mat = Math.max(0, Math.round((Number(pos.materialkosten_einheit) || 0) * 100) / 100)
  let vk = Math.round((lohn + mat) * 100) / 100
  if (vk > 0 && mat / vk > 0.30) {
    vk = Math.round((lohn / 0.70) * 100) / 100
    mat = Math.round((vk * 0.30) * 100) / 100
  }

  const menge = Number(pos.menge) || 1
  const gesamtpreis = Math.round(menge * vk * 100) / 100
  const matPct = vk > 0 ? Math.round((mat / vk) * 1000) / 10 : 0

  console.log(`ZEITANGABE OVERRIDE: User sagte ${userStunden}h, KI hatte ${kiMinuten} min → korrigiert auf ${userMinuten} min | ${stundensatz}€/h | Lohn ${lohn}€ | VK ${vk}€`)

  return {
    ...pos,
    lohnkosten_minuten: userMinuten,
    stundensatz,
    lohnkosten_einheit: Math.round((vk - mat) * 100) / 100,
    materialkosten_einheit: mat,
    vk_netto_einheit: vk,
    gesamtpreis,
    materialanteil_prozent: matPct,
    lohnanteil_prozent: Math.round((100 - matPct) * 10) / 10,
  }
}

// ─── Vorschlag-Erkennung ──────────────────────────────────────────────────

/** Wörter die NICHT als Schlüsselwort aus dem Kurztext extrahiert werden. */
const KEYWORD_STOPWORDS = new Set([
  'und', 'oder', 'mit', 'aus', 'auf', 'den', 'dem', 'des', 'die', 'das', 'ein', 'eine',
  'fuer', 'einer', 'einem', 'eines',
  'für', 'von', 'nach', 'zum', 'zur', 'beim', 'inkl', 'inklusive', 'sowie', 'bzw', 'etc',
  'gemäß', 'laut', 'per', 'je', 'stück', 'pauschal', 'laufmeter', 'meter',
  'wand', 'decke', 'raum', 'fläche', 'flaeche', 'bereich', 'kosten', 'arbeit', 'arbeiten',
])

function extractKeywords(leistungsname) {
  return String(leistungsname || '')
    .toLowerCase()
    .replace(/[()\/\-,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 5 && !KEYWORD_STOPWORDS.has(w))
}

/**
 * Erkennt KI-Vorschläge: Positionen die KEINEN Bezug zum User-Text haben.
 * Im Zweifel: KEIN Badge setzen.
 *
 * Matching-Strategie (3 Ebenen):
 *  1. Stem-Match: erste 6 Zeichen von Keyword im User-Text (löst Wortform-Varianten)
 *  2. Rückwärts-Stem: User-Wörter als Präfix im Kurztext (löst "grundier→grundierung")
 *  3. Synonym-Map: semantisch verwandte Begriffe (löst "streichen→Anstrich")
 *
 * Niemals Vorschlag: 01-xxx (BE), 13-xxx (Reinigung), bereits markierte.
 */
export function detectKiVorschlag(gewerke, eingabeText) {
  const norm = s => String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

  const eingabe = norm(eingabeText)

  // Synonyme: Wenn User-Text ein Trigger-Wort enthält, gelten die Aliase als
  // ebenfalls "genannt" und matchen gegen Positions-Keywords
  const SYNONYME = [
    [/streich|ausmal|malerarbeit/, ['anstrich', 'dispersi', 'farbanst', 'innenanst']],
    [/farb[e ]|farben /, ['anstrich', 'dispersi', 'farbanst']],
    [/grundier/, ['grundier', 'voranstr']],
    [/spachtel/, ['spachtel', 'glaettsp']],
    [/tapezier|tapete/, ['tapete', 'vliestap', 'tapezier']],
    [/vinyl|klickboden|bodenbelag/, ['vinyl', 'klickpar', 'bodenbe']],
    [/abdecken|abkleb|schutz/, ['abdeckar', 'schutzfo', 'abdeckun']],
    [/schleifen/, ['schleif', 'abschlei']],
    [/verfugen|fuggen/, ['verfug', 'fugenmoe']],
    [/abdicht/, ['abdicht']],
    [/daemm|daemmung/, ['daemmun', 'waermed']],
  ]

  // Eingabe um Synonym-Aliase erweitern
  let eingabePlus = eingabe
  for (const [re, aliase] of SYNONYME) {
    if (re.test(eingabe)) eingabePlus += ' ' + aliase.join(' ')
  }

  const STOPWORDS = new Set([
    'fuer', 'eine', 'einer', 'einem', 'eines', 'und', 'oder', 'mit', 'aus', 'auf',
    'den', 'dem', 'des', 'die', 'das', 'inkl', 'inklusive', 'sowie', 'pauschal',
    'meter', 'wand', 'decke', 'raum', 'flaeche', 'bereich', 'kosten', 'arbeit',
  ])
  const STEM = 6  // Präfix-Länge für Stem-Match

  return gewerke.map(gewerk => {
    // Wenn Gewerk-Name selbst im User-Text vorkommt → keine Position ist Vorschlag
    const gewerkNorm = norm(gewerk.name)
    const gewerkErwaehnt = gewerkNorm.split(/\s+/).some(w => w.length >= 4 && eingabe.includes(w))

    const positionen = (gewerk.positionen || []).map(pos => {
      if (pos.isVorschlag) return pos
      if (pos.unsicher) return pos  // Unsichere Positionen stammen aus User-Eingabe, NICHT als KI-Vorschlag markieren

      const nr = String(pos.leistungsnummer || '')
      if (nr.startsWith('01-')) return pos  // BE: immer automatisch, kein Badge
      if (nr.startsWith('13-')) return pos  // Reinigung: immer automatisch, kein Badge

      if (gewerkErwaehnt) return pos  // User hat dieses Gewerk erwähnt → kein Vorschlag

      const kurztext = norm(pos.leistungsname || '')
      const keywords = kurztext.split(/[\s\-–,\/()]+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w))

      if (keywords.length === 0) return pos

      // Ebene 1: Stem-Match vorwärts (Keyword-Präfix im User-Text)
      const stemVorwaerts = keywords.some(kw => {
        const stem = kw.slice(0, STEM)
        return stem.length >= 4 && eingabePlus.includes(stem)
      })
      if (stemVorwaerts) return pos

      // Ebene 2: Stem-Match rückwärts (User-Wort-Präfix im Kurztext)
      const userWords = eingabe.split(/\s+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))
      const stemRueckwaerts = userWords.some(uw => {
        const stem = uw.slice(0, STEM)
        return keywords.some(kw => kw.includes(stem))
      })
      if (stemRueckwaerts) return pos

      console.log(`[detectKiVorschlag] "${pos.leistungsname}" → kein Treffer [${keywords.join(', ')}] → isVorschlag=true`)
      return { ...pos, isVorschlag: true }
    })
    return { ...gewerk, positionen }
  })
}

/**
 * Detects "[VORSCHLAG]" anywhere in leistungsname OR beschreibung,
 * sets isVorschlag: true, and strips the tag from both fields completely.
 */
export function stripVorschlag(pos) {
  if (!pos || typeof pos !== 'object') return pos
  const name = String(pos.leistungsname || '')
  const desc = String(pos.beschreibung || '')
  if (!name.includes('[VORSCHLAG]') && !desc.includes('[VORSCHLAG]')) return pos
  return {
    ...pos,
    isVorschlag: true,
    leistungsname: name.replace(/\[VORSCHLAG\]\s*/gi, '').trim(),
    beschreibung: desc.replace(/\[VORSCHLAG\]\s*/gi, '').trim(),
  }
}

// ─── Zimmerbezeichnungen nachträglich einsetzen ───────────────────────────

/** Erkannte Zimmernamen (singular + plural, mit/ohne Artikel). */
const ZIMMER_NAMES = [
  'schlafzimmer', 'wohnzimmer', 'badezimmer', 'kinderzimmer', 'arbeitszimmer',
  'esszimmer', 'abstellraum', 'abstellzimmer', 'stiegenhaus', 'dachboden',
  'vorraum', 'diele', 'gang', 'keller', 'küche', 'wc', 'bad',
]
const ZIMMER_RE_GLOBAL = new RegExp(
  `\\b((?:${ZIMMER_NAMES.join('|')})(?:\\s*\\d+)?)\\b`,
  'gi'
)

/** Prüft ob ein Text bereits eine Zimmerbezeichnung enthält. */
function textHasRoom(text) {
  ZIMMER_RE_GLOBAL.lastIndex = 0
  return ZIMMER_RE_GLOBAL.test(String(text || '').toLowerCase())
}

/** Extrahiert alle Zimmer aus einem Textsegment (normalisiert + mit Ziffer). */
function extractRoomsFromSegment(text) {
  ZIMMER_RE_GLOBAL.lastIndex = 0
  const rooms = []
  let m
  const lower = String(text || '').toLowerCase()
  ZIMMER_RE_GLOBAL.lastIndex = 0
  while ((m = ZIMMER_RE_GLOBAL.exec(lower)) !== null) {
    const r = m[1].trim()
    if (!rooms.includes(r)) rooms.push(r)
  }
  return rooms // e.g. ["schlafzimmer", "bad 2"]
}

/** Capitalize first letter. */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
 * Inserts "im [Zimmer]" into a beschreibung at the most natural position.
 * Strategy: before ", inklusive" / ", inkl." → before first ", " → append.
 */
function insertRoomIntoBeschreibung(text, zimmer) {
  if (!text || !zimmer) return text
  const phrase = ` im ${capitalize(zimmer)}`
  // Before ", inklusive" or ", inkl"
  const inkIdx = text.search(/,\s*inkl(?:usive)?[\s.,:]/i)
  if (inkIdx > 0) return text.slice(0, inkIdx) + phrase + text.slice(inkIdx)
  // Before first ", "
  const commaIdx = text.indexOf(', ')
  if (commaIdx > 5) return text.slice(0, commaIdx) + phrase + text.slice(commaIdx)
  // Append (strip trailing period first)
  return text.replace(/\.\s*$/, '') + phrase + '.'
}

/**
 * After AI response: injects room labels into beschreibung where missing.
 * Parses eingabeText to map each position keyword → room, then patches.
 */
export function injectZimmerbezeichnungen(gewerke, eingabeText) {
  if (!eingabeText || !gewerke || gewerke.length === 0) return gewerke

  // Split input into segments (by "nächste Position" signal or bullet •)
  const segments = String(eingabeText)
    .split(/n[aä]chste\s+position|•/gi)
    .map(s => s.trim())
    .filter(s => s.length > 3)

  if (segments.length === 0) return gewerke

  // Build per-segment room list, carrying the last known room forward
  let lastRooms = []
  const segmentData = segments.map(seg => {
    const rooms = extractRoomsFromSegment(seg)
    if (rooms.length > 0) lastRooms = rooms
    else if (/selb|gleich|dort|dasselb/i.test(seg)) { /* keep lastRooms */ }
    // else: no room in segment, still keep lastRooms as fallback
    return { text: seg.toLowerCase(), rooms: rooms.length > 0 ? rooms : [...lastRooms] }
  })

  // Global fallback: first room found anywhere in input
  const globalRooms = extractRoomsFromSegment(String(eingabeText).toLowerCase())

  return gewerke.map(gewerk => {
    const positionen = (gewerk.positionen || []).map(pos => {
      const beschreibung = pos.beschreibung || ''

      // Skip if beschreibung already has a room
      if (textHasRoom(beschreibung)) return pos

      // Skip BE and headers
      const nr = String(pos.leistungsnummer || '')
      if (nr === '01-001' || nr === '01-002') return pos
      if (/[-–]\s*000$/.test(nr)) return pos

      // Find best matching segment by keyword overlap with leistungsname
      const keywords = extractKeywords(pos.leistungsname || '')
      let bestRooms = []
      let bestScore = -1

      for (const seg of segmentData) {
        if (seg.rooms.length === 0) continue
        const score = keywords.filter(kw => seg.text.includes(kw)).length
        if (score > bestScore) {
          bestScore = score
          bestRooms = seg.rooms
        }
      }

      // Fallback to global rooms
      if (bestRooms.length === 0) bestRooms = globalRooms
      if (bestRooms.length === 0) return pos

      // Use first room (if multiple: join them e.g. "Schlafzimmer und Bad")
      const zimmer = bestRooms.length === 1
        ? bestRooms[0]
        : bestRooms.map(capitalize).join(' und ')

      const newBeschreibung = insertRoomIntoBeschreibung(beschreibung, zimmer)
      if (newBeschreibung === beschreibung) return pos

      console.log(`[injectZimmer] "${pos.leistungsname}" → Zimmer "${capitalize(zimmer)}" in Langtext eingefügt`)
      return { ...pos, beschreibung: newBeschreibung }
    })
    return { ...gewerk, positionen }
  })
}

// ─── Nullpreise korrigieren ───────────────────────────────────────────────

/**
 * After AI response: finds positions with 0€ price and sets a fallback
 * based on the Gewerk's hourly rate from catalog Regiestunden entries.
 * Exceptions: headers (-000), Baustelleneinrichtung (01-001/01-002), Material für Regie.
 */
export function fixNullpreise(gewerke, catalog, stundensaetze = {}) {
  console.log('[fixNullpreise] aufgerufen – Gewerke:', gewerke?.length, '| Katalog:', catalog?.length)
  if (!gewerke || gewerke.length === 0) return gewerke

  // Build hourly-rate map from catalog Regiestunden-Positionen (erkannt per Name + Einheit)
  const regieMap = {}
  if (catalog) {
    for (const entry of catalog) {
      const nr = String(entry.nr || '')
      if (!isSpecialPosition(nr)) continue
      if (Number(entry.preis || 0) <= 0) continue
      // Nur echte Regiestunden (Name + Einheit), nicht Variable oder Material
      if (!isRegiestundenPos({ leistungsname: entry.name, einheit: entry.einheit }, entry)) continue
      const prefix = nr.split('-')[0]
      if (!regieMap[prefix]) regieMap[prefix] = Number(entry.preis)
    }
  }

  // Catalog price lookup for specific positions (e.g. 13-100 for fine cleaning)
  const catalogPriceMap = {}
  if (catalog) {
    for (const entry of catalog) {
      const nr = String(entry.nr || '')
      if (Number(entry.preis || 0) > 0) catalogPriceMap[nr] = Number(entry.preis)
    }
  }

  return gewerke.map(gewerk => {
    const prefix = GEWERK_PREFIX_MAP[gewerk.name] || null
    const stundensatz =
      (prefix && regieMap[prefix]) ||
      Number(stundensaetze?.[gewerk.name] || 0) ||
      70 // absolute fallback

    const positionen = (gewerk.positionen || []).map(pos => {
      const nr = String(pos.leistungsnummer || '')

      // Exceptions
      if (nr === '01-001' || nr === '01-002') return pos
      if (/[-–]\s*000$/.test(nr)) return pos
      // Material für Regiestunden – Preis wird separat von applyRegieMaterial berechnet
      const catalogEntryForCheck = catalog?.find(e => String(e.nr) === nr) || null
      if (isMaterialFuerRegiePos(pos, catalogEntryForCheck)) return pos

      const vk = Number(pos.vk_netto_einheit) || 0
      const gesamtpreis = Number(pos.gesamtpreis) || 0
      console.log(`[fixNullpreise] Prüfe: ${nr} "${pos.leistungsname}" | vk_netto_einheit=${vk} | gesamtpreis=${gesamtpreis} | menge=${pos.menge} | einheit=${pos.einheit}`)
      if (vk > 0 && gesamtpreis > 0) return pos // price is fine

      const menge = Number(pos.menge) || 1
      const einheit = String(pos.einheit || '').toLowerCase()
      let newPreis, newGesamtpreis, minuten

      // Special handling for Reinigung (13-xxx)
      if (/^13-/.test(nr)) {
        const reinigungs_stundensatz = regieMap['13'] || stundensatz

        if (einheit === 'm²' || einheit === 'm2') {
          // Use catalog price for this specific cleaning position, fallback to 13-100 price
          const catalogPreis = catalogPriceMap[nr] || catalogPriceMap['13-100'] || 10.40
          newPreis = catalogPreis
          newGesamtpreis = Math.round(newPreis * menge * 100) / 100
          minuten = Math.round((newPreis / reinigungs_stundensatz) * 60)
        } else {
          // Pauschal: minimum 1 hour
          minuten = Math.max(60, menge * 60)
          newPreis = Math.round((minuten / 60) * reinigungs_stundensatz * 100) / 100
          newGesamtpreis = Math.round(newPreis * menge * 100) / 100
        }
        console.log(`[fixNullpreise] REINIGUNG KORRIGIERT: "${pos.leistungsname}" → ${newPreis.toFixed(2)}€/${einheit || 'pausch'} (${menge} ${einheit || 'pausch'} = ${newGesamtpreis.toFixed(2)}€)`)
      } else {
        // General fallback: estimate time based on quantity and unit type
        if (einheit === 'pauschal' || einheit === 'pausch' || einheit === 'psch') {
          // Pauschal-Positionen: mindestens 2 Stunden (z.B. Abdeckarbeiten, Baustellenreinigung etc.)
          minuten = Math.max(120, Math.round(menge * 120))
        } else {
          minuten = Math.round(Math.max(30, menge * 5)) // ≥30min, or 5min/unit
        }
        newPreis = Math.round((minuten / 60) * stundensatz * 100) / 100
        newGesamtpreis = Math.round(newPreis * menge * 100) / 100
        console.log(`[fixNullpreise] NULLPREIS KORRIGIERT: "${pos.leistungsname}" → ${newPreis.toFixed(2)}€/Einheit (${stundensatz}€/h × ${minuten}min, einheit=${einheit})`)
      }

      return {
        ...pos,
        vk_netto_einheit: newPreis,
        gesamtpreis: newGesamtpreis,
        lohnkosten_einheit: newPreis,
        lohnkosten_minuten: minuten || 0,
        stundensatz,
        materialkosten_einheit: 0,
        materialanteil_prozent: 0,
        lohnanteil_prozent: 100,
      }
    })
    return { ...gewerk, positionen }
  })
}

// ─── Feinreinigung sicherstellen ──────────────────────────────────────────

const STAUBINTENSIV_KW = [
  'abbruch', 'stemm', 'fliesen', 'spachtel', 'schleifen', 'maler', 'ausmalen',
  'trockenbau', 'estrich', 'putz', 'verputz',
]

/**
 * Post-processing nach KI-Antwort:
 * Stellt sicher dass im Gewerk Reinigung genau EINE Position vorhanden ist.
 * - Falls bereits eine oder mehr Positionen vorhanden: teurere behalten, keine neue hinzufügen.
 * - Falls keine Position vorhanden: passende aus Katalog einfügen.
 */
export function ensureFeinreinigung(gewerke, catalog, stundensaetze = {}) {
  if (!gewerke || gewerke.length === 0) return gewerke

  const norm = s => String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

  // Reinigung-Gewerk finden
  const rIdx = gewerke.findIndex(g => norm(g.name).includes('reinigung'))
  if (rIdx === -1) return gewerke

  const rGewerk = gewerke[rIdx]
  let pos = rGewerk.positionen || []

  // Bereits eine oder mehr Positionen vorhanden → teurere behalten, fertig
  if (pos.length >= 1) {
    if (pos.length === 1) return gewerke
    const teuerste = pos.reduce((best, p) =>
      (p.gesamtpreis || 0) >= (best.gesamtpreis || 0) ? p : best
    , pos[0])
    const newGewerke = [...gewerke]
    newGewerke[rIdx] = { ...rGewerk, positionen: [teuerste], zwischensumme: teuerste.gesamtpreis || 0 }
    return newGewerke
  }

  // Schritt 3: Keine Reinigungsposition vorhanden → eine hinzufügen
  const hasStaub = gewerke.some(g =>
    (g.positionen || []).some(p => {
      const text = norm(`${p.leistungsname || ''} ${p.beschreibung || ''}`)
      return STAUBINTENSIV_KW.some(kw => text.includes(kw))
    })
  )

  // Katalog-Eintrag wählen: Feinreinigung bei Staub, sonst Besenrein
  const targetNr = hasStaub ? '13-100' : '13-001'
  const catalogEntry = (catalog || []).find(e => String(e.nr || '') === targetNr)
    || (catalog || []).find(e => String(e.nr || '').startsWith('13') && norm(e.name || '').includes(hasStaub ? 'feinrein' : 'besenrein'))

  const menge = 50
  const stundensatz = Number(stundensaetze?.['Reinigung'] || 55)

  let newPos
  if (catalogEntry) {
    const preis = Math.round(Number(catalogEntry.preis || 0) * 100) / 100
    const minuten = Math.round(Number(catalogEntry.zeit_min || 0))
    const lohn = stundensatz > 0 && minuten > 0
      ? Math.min(Math.round((minuten / 60) * stundensatz * 100) / 100, preis)
      : preis
    const mat = Math.max(0, Math.round((preis - lohn) * 100) / 100)
    const gesamtpreis = Math.round(menge * preis * 100) / 100
    const matPct = preis > 0 ? Math.round((mat / preis) * 1000) / 10 : 0
    newPos = {
      leistungsnummer: catalogEntry.nr,
      leistungsname: catalogEntry.name,
      beschreibung: trimBeschreibung(catalogEntry.beschreibung) || (hasStaub
        ? 'Fachgerechte Feinreinigung aller Räume nach Abschluss der Bauarbeiten.'
        : 'Fachgerechte Baustellenreinigung besenrein nach Abschluss der Arbeiten.'),
      menge,
      einheit: catalogEntry.einheit || 'm²',
      vk_netto_einheit: preis,
      gesamtpreis,
      materialkosten_einheit: mat,
      materialanteil_prozent: matPct,
      lohnkosten_minuten: minuten,
      stundensatz,
      lohnkosten_einheit: lohn,
      lohnanteil_prozent: Math.round((100 - matPct) * 10) / 10,
      aus_preisliste: true,
      gewerk: 'Reinigung',
    }
    console.log(`[ensureFeinreinigung] Neu eingefügt ${catalogEntry.nr}: ${menge}m² × ${preis}€ = ${gesamtpreis}€`)
  } else {
    const preis = hasStaub ? 7.00 : 3.50
    const gesamtpreis = Math.round(menge * preis * 100) / 100
    newPos = {
      leistungsnummer: hasStaub ? '13-NEU' : '13-NEU1',
      leistungsname: hasStaub ? 'Bauschlussreinigung feinrein' : 'Baureinigung besenrein',
      beschreibung: hasStaub
        ? 'Fachgerechte Feinreinigung aller Räume nach Abschluss der Bauarbeiten.'
        : 'Fachgerechte Baustellenreinigung besenrein nach Abschluss der Arbeiten.',
      menge,
      einheit: 'm²',
      vk_netto_einheit: preis,
      gesamtpreis,
      materialkosten_einheit: 0,
      materialanteil_prozent: 0,
      lohnkosten_minuten: Math.round((preis / stundensatz) * 60),
      stundensatz,
      lohnkosten_einheit: preis,
      lohnanteil_prozent: 100,
      aus_preisliste: false,
      gewerk: 'Reinigung',
    }
    console.log(`[ensureFeinreinigung] Fallback: ${menge}m² × ${preis}€ = ${gesamtpreis}€`)
  }

  const newGewerke = [...gewerke]
  newGewerke[rIdx] = {
    ...rGewerk,
    positionen: [newPos],
    zwischensumme: newPos.gesamtpreis || 0,
  }
  return newGewerke
}

/**
 * DEDUPLIZIERUNG: Fasst Positionen mit gleicher Leistungsnummer innerhalb eines Gewerks zusammen.
 * Mengen werden addiert, Gesamtpreis wird neu berechnet, Langtexte werden zusammengeführt.
 * Betrifft NUR Katalog-Positionen (aus_preisliste: true) und NEU-Positionen mit gleicher Nummer.
 * Header-Positionen (-000) und Spezial-Positionen (990-999: Regie/Material/Variable) werden NICHT zusammengefasst.
 */
export function deduplicatePositionen(gewerke) {
  if (!gewerke || gewerke.length === 0) return gewerke

  return gewerke.map(g => {
    const positionen = g.positionen || []
    if (positionen.length <= 1) return g

    const merged = []
    const seen = new Map() // leistungsnummer → index in merged[]

    for (const pos of positionen) {
      const nr = String(pos.leistungsnummer || '').trim()

      // Header (-000) und Spezial-Positionen (990-999) nie zusammenfassen
      if (!nr || /[-–]\s*000$/.test(nr) || isSpecialPosition(nr)) {
        merged.push(pos)
        continue
      }

      if (seen.has(nr)) {
        // Duplikat gefunden → Mengen addieren
        const idx = seen.get(nr)
        const existing = merged[idx]
        const newMenge = (existing.menge || 0) + (pos.menge || 0)
        const vk = existing.vk_netto_einheit || 0

        // Langtext zusammenführen wenn unterschiedlich
        let beschreibung = existing.beschreibung || ''
        const posBeschreibung = pos.beschreibung || ''
        if (posBeschreibung && !beschreibung.includes(posBeschreibung)) {
          beschreibung = beschreibung + ' ' + posBeschreibung
        }

        merged[idx] = {
          ...existing,
          menge: Number(newMenge.toFixed(2)),
          gesamtpreis: Number((newMenge * vk).toFixed(2)),
          beschreibung,
        }
        isDev && console.log(`[Deduplizierung] ${nr}: ${existing.menge} + ${pos.menge} = ${newMenge} ${existing.einheit || ''}`)
      } else {
        seen.set(nr, merged.length)
        merged.push({ ...pos })
      }
    }

    // Zwischensumme neu berechnen
    const zwischensumme = merged.reduce((sum, p) => sum + (p.gesamtpreis || 0), 0)

    return { ...g, positionen: merged, zwischensumme: Number(zwischensumme.toFixed(2)) }
  })
}

/**
 * Finaler Sicherheitscheck: Falls im Gewerk Reinigung mehr als eine Position vorhanden ist,
 * wird nur die teuerste behalten. Verhindert zuverlässig doppelte Reinigungspositionen.
 */
export function deduplicateReinigung(gewerke) {
  if (!gewerke || gewerke.length === 0) return gewerke
  const norm = s => String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  const rIdx = gewerke.findIndex(g => norm(g.name).includes('reinigung'))
  if (rIdx === -1) return gewerke
  const rGewerk = gewerke[rIdx]
  const pos = rGewerk.positionen || []
  if (pos.length <= 1) return gewerke
  const teuerste = pos.reduce((best, p) =>
    (p.gesamtpreis || 0) >= (best.gesamtpreis || 0) ? p : best
  , pos[0])
  const newGewerke = [...gewerke]
  newGewerke[rIdx] = { ...rGewerk, positionen: [teuerste], zwischensumme: teuerste.gesamtpreis || 0 }
  return newGewerke
}

/**
 * SMART REINIGUNG – vollständige Frontend-Kalkulation der Reinigungsposition.
 * Ersetzt fixReinigungMenge, ensureFeinreinigung und deduplicateReinigung komplett.
 *
 * Schritt 1: Bodenfläche aus dem Angebot schätzen (direkt → Wand÷3 → Raum → Fallback)
 * Schritt 2: Art der Reinigung entscheiden (Feinreinigung / Baureinigung / Stunden)
 * Schritt 3: Position aus Preisliste berechnen und in Gewerke einsetzen
 * Schritt 4: Sicherheitsnetz – max. 3.000 €
 */
export function smartReinigung(gewerke, catalog, stundensaetze = {}, opts = {}) {
  if (!gewerke || gewerke.length === 0) return gewerke

  // Wenn User Reinigung explizit gelöscht hat → nicht wieder einfügen
  if (opts.reinigungEntfernt) {
    console.log('smartReinigung: übersprungen (reinigungEntfernt=true)')
    return gewerke
  }

  const norm = s => String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

  // Wenn der User die Reinigungsposition manuell bearbeitet hat, nicht überschreiben
  const rGewerk = gewerke.find(g => norm(g.name).includes('reinigung'))
  if (rGewerk?.positionen?.some(p => p.manuellBearbeitet)) {
    console.log('smartReinigung: übersprungen (manuellBearbeitet=true)')
    return gewerke
  }

  // Stundensatz Reinigung: aus Preisliste (Regiestunden im 990-999 Bereich) oder Stammdaten
  let reinigungStundensatz = Number(stundensaetze?.['Reinigung']) || 55
  if (catalog) {
    const regie = catalog.find(e => {
      const nr = String(e.nr || '')
      return nr.startsWith('13-') && isSpecialPosition(nr) &&
        isRegiestundenPos({ leistungsname: e.name, einheit: e.einheit }, e) &&
        Number(e.preis) > 0
    })
    if (regie) reinigungStundensatz = Number(regie.preis)
  }

  // ── SCHRITT 1: Bodenfläche schätzen ──────────────────────────────────────
  const RAUM_M2 = {
    schlafzimmer: 15, wohnzimmer: 25, bad: 8, badezimmer: 8, wc: 4,
    kueche: 12, kuechen: 12, flur: 8, vorzimmer: 8, gang: 8,
    kinderzimmer: 12, arbeitszimmer: 12, diele: 8, stiegenhaus: 10,
  }

  // Nur echte Flächeneinheiten (m², m2) – kein lm oder andere
  const istFlaechenEinheit = e => {
    const u = String(e || '').trim().toLowerCase()
    return u === 'm²' || u === 'm2' || u === 'm ²'
  }

  // Höchste Priorität: Abdeckarbeiten-Position mit Bodenfläche
  const ABDECKBODEN_KW = ['abdeckarbeiten boden', 'bodenflaechen abdecken', 'bodenflächen abdecken', 'abdeckpapier', 'boden abdecken', 'abdecken boden', 'bodenabdeckung', 'boeden abdecken']
  let abdeckBodenM2 = 0
  for (const g of gewerke) {
    if (norm(g.name).includes('reinigung')) continue
    for (const p of (g.positionen || [])) {
      if (!istFlaechenEinheit(p.einheit)) continue
      const menge = Number(p.menge) || 0
      if (menge <= 0) continue
      const posText = norm(`${p.leistungsname || ''} ${p.beschreibung || ''}`)
      if (ABDECKBODEN_KW.some(kw => posText.includes(kw))) {
        abdeckBodenM2 = Math.max(abdeckBodenM2, menge)
        console.log(`[smartReinigung] Abdeckarbeiten-Boden gefunden: "${p.leistungsname}" → ${menge}m²`)
      }
    }
  }

  let bodenflaecheDirekt = 0  // höchste Priorität: Boden direkt gemessen
  let wandflaecheSum = 0      // Wand-m² (÷3 → Bodenfläche)
  const seenRooms = new Set()
  let raumTotal = 0

  for (const g of gewerke) {
    if (norm(g.name).includes('reinigung')) continue
    const gn = norm(g.name)

    // Gewerk-Typ nach Name (entspricht Gewerk-Prefix 12, 11, 09/10, 08)
    const istBodenleger  = gn.includes('bodenleger') || gn.includes('parkett')
    const istFliesenleger = gn.includes('fliesenleger')
    const istMaler       = gn.includes('maler') || gn.includes('anstreicher')
    const istTrockenbau  = gn.includes('trockenbau')

    for (const p of (g.positionen || [])) {
      const menge = Number(p.menge) || 0
      if (menge <= 0) continue

      // c) Raumbasierte Schätzung: Raumnamen aus Kurztext + Langtext erkennen
      const posText = norm(`${p.leistungsname || ''} ${p.beschreibung || ''}`)
      for (const [room, m2] of Object.entries(RAUM_M2)) {
        if (posText.includes(room) && !seenRooms.has(room)) {
          seenRooms.add(room)
          raumTotal += m2
        }
      }

      // Nur Flächenpositionen (m²) für direkte Flächenmessung
      if (!istFlaechenEinheit(p.einheit)) continue

      if (istBodenleger) {
        // a) Gewerk 12: Bodenleger → direkte Bodenfläche
        bodenflaecheDirekt += menge
      } else if (istFliesenleger) {
        // a) Gewerk 11: Fliesenleger-Boden → direkt; sonst Wand
        const istBodenPos = posText.includes('boden') || posText.includes('floor')
        if (istBodenPos) bodenflaecheDirekt += menge
        else wandflaecheSum += menge
      } else if (istMaler || istTrockenbau) {
        // b) Gewerk 08/09/10: Decke → direkt (1:1); Wand → summieren (÷3)
        const istDecke = posText.match(/\b(decke|ceiling|deckenanstrich|deckenflaeche)\b/)
        if (istDecke) bodenflaecheDirekt += menge
        else wandflaecheSum += menge
      }
    }
  }

  let geschaetzteBodenflaecheM2
  let flaecheQuelle
  if (abdeckBodenM2 > 0) {
    geschaetzteBodenflaecheM2 = abdeckBodenM2
    flaecheQuelle = `Abdeckarbeiten-Boden ${abdeckBodenM2}m²`
  } else if (bodenflaecheDirekt > 0) {
    geschaetzteBodenflaecheM2 = bodenflaecheDirekt
    flaecheQuelle = 'Bodenleger/Fliesenleger-Boden/Decke direkt'
  } else if (wandflaecheSum > 0) {
    geschaetzteBodenflaecheM2 = Math.round(wandflaecheSum / 3)
    flaecheQuelle = `Wandfläche ${wandflaecheSum}m² ÷ 3`
  } else if (raumTotal > 0) {
    geschaetzteBodenflaecheM2 = raumTotal
    flaecheQuelle = `Raumschätzung: ${[...seenRooms].join(', ')}`
  } else {
    geschaetzteBodenflaecheM2 = 40
    flaecheQuelle = 'Fallback 40m²'
  }
  // Hard cap 200m²
  geschaetzteBodenflaecheM2 = Math.min(Math.round(geschaetzteBodenflaecheM2), 200)
  console.log(`REINIGUNG: Geschätzte Bodenfläche = ${geschaetzteBodenflaecheM2}m² (Quelle: ${flaecheQuelle})`)

  // ── SCHRITT 2: Art der Reinigung entscheiden ──────────────────────────────
  // Welche Gewerke (außer Reinigung) sind im Angebot?
  const gewerkNamen = gewerke
    .filter(g => !norm(g.name).includes('reinigung'))
    .map(g => norm(g.name))

  // Feinreinigung-Trigger: Fertige Oberflächen + staubintensive Gewerke
  const hatFertigeOberflaechen = gewerkNamen.some(n =>
    n.includes('bodenleger') || n.includes('parkett') ||
    n.includes('fliesenleger') ||
    n.includes('maler') || n.includes('anstreicher') ||
    n.includes('baumeister') || n.includes('verputz') || n.includes('estrich') ||
    n.includes('abbruch')
  )

  let targetNr
  let artLabel
  if (geschaetzteBodenflaecheM2 < 10) {
    // c) Zu kleine Fläche → Stunden-Abrechnung
    targetNr = 'STUNDEN'
    artLabel = 'Stunden'
  } else if (hatFertigeOberflaechen) {
    // a) Fertige Oberflächen → Feinreinigung
    targetNr = '13-100'
    artLabel = 'Feinreinigung'
  } else {
    // b) Nur Rohbau/Abbruch/Trockenbau → Baureinigung besenrein
    targetNr = '13-001'
    artLabel = 'Baureinigung besenrein'
  }

  // ── SCHRITT 3: Position berechnen und einsetzen ───────────────────────────
  let newPos
  if (targetNr === 'STUNDEN') {
    // Stunden-Abrechnung: 1h pro 15m², mindestens 2h
    const stunden = Math.max(2, Math.round(geschaetzteBodenflaecheM2 / 15))
    const ep = reinigungStundensatz
    const gp = Math.round(stunden * ep * 100) / 100
    const regieEntry = catalog?.find(e => {
      const nr = String(e.nr || '')
      return nr.startsWith('13-') && isSpecialPosition(nr) &&
        isRegiestundenPos({ leistungsname: e.name, einheit: e.einheit }, e)
    })
    newPos = {
      leistungsnummer: regieEntry?.nr || '13-998',
      leistungsname: regieEntry?.name || 'Reinigung Regiestunden',
      beschreibung: 'Reinigungsarbeiten nach Abschluss der Bauarbeiten, abgerechnet nach Aufwand.',
      menge: stunden,
      einheit: 'Stunde(n)',
      vk_netto_einheit: ep,
      gesamtpreis: gp,
      materialkosten_einheit: 0,
      materialanteil_prozent: 0,
      lohnkosten_minuten: 60,
      stundensatz: reinigungStundensatz,
      lohnkosten_einheit: ep,
      lohnanteil_prozent: 100,
      aus_preisliste: !!regieEntry,
      gewerk: 'Reinigung',
    }
  } else {
    // m²-Abrechnung: Preis + Kostenaufteilung aus Preisliste
    const catalogEntry = catalog?.find(e => String(e.nr || '') === targetNr)
    const preis = catalogEntry
      ? Math.round(Number(catalogEntry.preis || 0) * 100) / 100
      : (targetNr === '13-100' ? 12 : 5)
    const menge = geschaetzteBodenflaecheM2
    const minuten = catalogEntry ? Math.round(Number(catalogEntry.zeit_min || 0)) : 0
    // Lohnkosten aus Katalog-Zeitangabe; falls keine → alles Lohn
    const lohn = (reinigungStundensatz > 0 && minuten > 0)
      ? Math.min(Math.round((minuten / 60) * reinigungStundensatz * 100) / 100, preis)
      : preis
    const mat = Math.max(0, Math.round((preis - lohn) * 100) / 100)
    const gesamtpreis = Math.round(menge * preis * 100) / 100
    const matPct = preis > 0 ? Math.round((mat / preis) * 1000) / 10 : 0

    const fallbackBeschreibung = targetNr === '13-100'
      ? 'Fachgerechte Feinreinigung aller Räume nach Abschluss der Bauarbeiten.'
      : 'Fachgerechte Baustellenreinigung besenrein nach Abschluss der Arbeiten.'

    newPos = {
      leistungsnummer: catalogEntry?.nr || targetNr,
      leistungsname: catalogEntry?.name || (targetNr === '13-100' ? 'Bauschlussreinigung feinrein' : 'Baureinigung besenrein'),
      beschreibung: (catalogEntry ? trimBeschreibung(catalogEntry.beschreibung) : '') || fallbackBeschreibung,
      menge,
      einheit: catalogEntry?.einheit || 'm²',
      vk_netto_einheit: preis,
      gesamtpreis,
      materialkosten_einheit: mat,
      materialanteil_prozent: matPct,
      lohnkosten_minuten: minuten,
      stundensatz: reinigungStundensatz,
      lohnkosten_einheit: lohn,
      lohnanteil_prozent: Math.round((100 - matPct) * 10) / 10,
      aus_preisliste: !!catalogEntry,
      gewerk: 'Reinigung',
    }
  }

  // ── SCHRITT 4: Sicherheitsnetz – max. 3.000 € ────────────────────────────
  const MAX_REINIGUNG = 3000
  if (newPos.gesamtpreis > MAX_REINIGUNG) {
    const altPreis = newPos.gesamtpreis
    const cappedMenge = newPos.vk_netto_einheit > 0
      ? Math.floor(MAX_REINIGUNG / newPos.vk_netto_einheit)
      : newPos.menge
    const cappedGP = Math.round(cappedMenge * newPos.vk_netto_einheit * 100) / 100
    console.warn(`REINIGUNG SMART: Gesamtpreis ${altPreis}€ > ${MAX_REINIGUNG}€ → Menge ${newPos.menge}→${cappedMenge}, neuer Preis ${cappedGP}€`)
    newPos = { ...newPos, menge: cappedMenge, gesamtpreis: cappedGP }
  }

  console.log(`REINIGUNG SMART: ${artLabel} | ${newPos.menge} ${newPos.einheit} × ${newPos.vk_netto_einheit}€ = ${newPos.gesamtpreis}€ (Fläche geschätzt aus: ${flaecheQuelle})`)

  // ── Position in Gewerke einsetzen (bestehende überschreiben oder neu anlegen) ──
  const rIdx = gewerke.findIndex(g => norm(g.name).includes('reinigung'))
  const newGewerke = [...gewerke]
  if (rIdx >= 0) {
    newGewerke[rIdx] = { ...gewerke[rIdx], positionen: [newPos], zwischensumme: newPos.gesamtpreis }
  } else {
    newGewerke.push({ name: 'Reinigung', positionen: [newPos], zwischensumme: newPos.gesamtpreis })
  }
  return newGewerke
}

/**
 * Prüft und korrigiert den GU-Aufschlag einer NEU-kalkulierten Position.
 * Katalogpositionen (aus_preisliste: true) werden NICHT angefasst.
 * settings: { aufschlag_gesamt_prozent: 20 }
 */
export function verifyAufschlaege(position, settings = {}) {
  if (!position || position.aus_preisliste === true) return position

  const aufschlag = (settings.aufschlag_gesamt_prozent ?? 20) / 100
  const mat = Number(position.materialkosten_einheit) || 0
  const lohn = Number(position.lohnkosten_einheit) || 0
  const menge = Number(position.menge) || 1

  if (mat === 0 && lohn === 0) return position

  const zwischensumme = mat + lohn
  const sollPreis = Math.round(zwischensumme * (1 + aufschlag) * 100) / 100
  const istPreis = Number(position.vk_netto_einheit) || 0
  const toleranz = sollPreis * 0.02

  if (istPreis >= sollPreis - toleranz) return position  // passt

  console.log(`AUFSCHLAG KORREKTUR: KI gab ${istPreis} €, korrigiert auf ${sollPreis} € (Zwischensumme ${zwischensumme.toFixed(2)} × ${(1 + aufschlag).toFixed(2)})`)

  const gesamtpreis = Math.round(menge * sollPreis * 100) / 100
  const materialanteil_prozent = mat > 0 ? Math.round(mat / sollPreis * 1000) / 10 : 0
  const lohnanteil_prozent = Math.round((100 - materialanteil_prozent) * 10) / 10

  return {
    ...position,
    vk_netto_einheit: sollPreis,
    gesamtpreis,
    materialanteil_prozent,
    lohnanteil_prozent,
  }
}

/**
 * Wendet verifyAufschlaege auf alle Positionen in einem Gewerke-Array an.
 */
export function verifyAufschlaegeGewerke(gewerke, settings = {}) {
  return gewerke.map(g => ({
    ...g,
    positionen: (g.positionen || []).map(p => verifyAufschlaege(p, settings)),
  }))
}
