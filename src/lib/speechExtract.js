/**
 * Extrahiert Ergänzungen und Hinweise aus dem gesprochenen Text.
 *
 * Erkennt Schlüsselwörter wie "Ergänzung", "Hinweis" im Sprachtext
 * und trennt diese Abschnitte vom eigentlichen Angebotstext.
 *
 * Beispiel-Input:
 *   "Badezimmer sanieren, Fliesen verlegen, Ergänzung der Schlüssel muss abgeholt werden,
 *    Hinweis der Kunde verzichtet auf Grundierung, außerdem Decke streichen"
 *
 * Ergebnis:
 *   cleanedText: "Badezimmer sanieren, Fliesen verlegen, außerdem Decke streichen"
 *   ergaenzungen: ["der Schlüssel muss abgeholt werden"]
 *   hinweise: ["der Kunde verzichtet auf Grundierung"]
 */

// Section markers: "Ergänzung", "Hinweis", and their plurals
// Also: "als Ergänzung", "noch eine Ergänzung", "weiterer Hinweis", "noch ein Hinweis"
const SECTION_MARKERS = [
  { type: 'ergaenzung', re: /(?:(?:als|noch\s+eine?|weitere[rs]?)\s+)?erg[äa]nzung(?:en)?/i },
  { type: 'hinweis',    re: /(?:(?:als|noch\s+eine?n?|weitere[rs]?)\s+)?hinweis(?:e)?/i },
]

// Build a combined regex that matches any section marker
function buildSectionRegex() {
  const parts = SECTION_MARKERS.map(m => `(${m.re.source})`)
  return new RegExp(`\\b(?:${parts.join('|')})\\b[,:\\s]*`, 'gi')
}

const COMBINED_RE = buildSectionRegex()

// End markers: speech transitions, bullet points, newlines that signal the
// Ergänzung/Hinweis content has ended and normal position text resumes.
// These are NOT consumed — they stay in the cleaned text.
const END_MARKERS_RE = /(?:\n•|\b(?:n[aä]chste\s+position|n[aä]chster\s+punkt|weiters|au[sß]erdem|zus[aä]tzlich|dann\s+noch|und\s+dann|dann\b|ansonsten|des\s+weiteren|dar[uü]ber\s+hinaus))/gi

/**
 * Classify a matched keyword into 'ergaenzung' or 'hinweis'
 */
function classifyKeyword(keyword) {
  const lower = keyword.toLowerCase().replace(/[,:\s]+$/, '')
  if (/erg[äa]nzung/i.test(lower)) return 'ergaenzung'
  if (/hinweis/i.test(lower)) return 'hinweis'
  return null
}

/**
 * Find the earliest end boundary for an Ergänzung/Hinweis section.
 * Stops at: next section marker, end marker (speech transition), newline+bullet, or sentence end.
 */
function findContentEnd(text, contentStart, nextSectionStart) {
  // Default: next section marker or end of text
  let end = nextSectionStart

  // Search within the content range for end markers
  const searchArea = text.slice(contentStart, nextSectionStart)

  // Check for end markers (speech transitions, bullet points)
  END_MARKERS_RE.lastIndex = 0
  const endMatch = END_MARKERS_RE.exec(searchArea)
  if (endMatch) {
    end = contentStart + endMatch.index
  }

  // Also check for sentence-ending punctuation followed by a capital letter (new sentence)
  // This catches: "Schlüssel abholen. Decke streichen"
  const sentenceEndRe = /[.!?]\s+(?=[A-ZÄÖÜ])/g
  const sentenceMatch = sentenceEndRe.exec(searchArea)
  if (sentenceMatch) {
    const sentenceEnd = contentStart + sentenceMatch.index + 1 // include the period
    if (sentenceEnd < end) {
      end = sentenceEnd
    }
  }

  return end
}

/**
 * Extracts Ergänzungen and Hinweise sections from speech text.
 *
 * @param {string} text - The full transcribed speech text
 * @returns {{ cleanedText: string, ergaenzungen: string[], hinweise: string[] }}
 */
export function extractErgaenzungenHinweise(text) {
  if (!text) return { cleanedText: text || '', ergaenzungen: [], hinweise: [] }

  // Reset lastIndex for global regex
  COMBINED_RE.lastIndex = 0
  const matches = [...text.matchAll(COMBINED_RE)]

  if (matches.length === 0) {
    return { cleanedText: text, ergaenzungen: [], hinweise: [] }
  }

  const ergaenzungen = []
  const hinweise = []
  const segments = [] // { start, end, type } – parts to remove from text

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const keywordStart = match.index
    const contentStart = keywordStart + match[0].length

    // Default: content runs until the next section marker or end of text
    const nextSectionStart = i + 1 < matches.length ? matches[i + 1].index : text.length

    // Find the actual content end (may be earlier due to speech transitions / sentence breaks)
    const contentEnd = findContentEnd(text, contentStart, nextSectionStart)

    // Clean up content: trim, remove trailing punctuation artifacts
    let content = text.slice(contentStart, contentEnd).trim()
    // Remove trailing comma/period/semicolon that might be a separator to the next clause
    content = content.replace(/[,;.]+\s*$/, '').trim()

    if (!content) continue

    const type = classifyKeyword(match[0])
    if (!type) continue

    if (type === 'ergaenzung') {
      ergaenzungen.push(content)
    } else {
      hinweise.push(content)
    }

    segments.push({ start: keywordStart, end: contentEnd })
  }

  if (segments.length === 0) {
    return { cleanedText: text, ergaenzungen: [], hinweise: [] }
  }

  // Build cleaned text by removing extracted segments (reverse order to preserve indices)
  let cleanedText = text
  for (let i = segments.length - 1; i >= 0; i--) {
    const { start, end } = segments[i]
    cleanedText = cleanedText.slice(0, start) + cleanedText.slice(end)
  }

  // Clean up whitespace, double commas, leading/trailing punctuation
  cleanedText = cleanedText
    .replace(/,\s*,/g, ',')           // double commas
    .replace(/\s{2,}/g, ' ')          // multiple spaces
    .replace(/^\s*[,;.]\s*/, '')      // leading punctuation
    .replace(/\s*[,;.]\s*$/, '')      // trailing punctuation
    .trim()

  return { cleanedText, ergaenzungen, hinweise }
}
