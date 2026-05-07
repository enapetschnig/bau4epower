/**
 * Normalisiert eine Telefonnummer ins österreichische E.164-Format (+43…).
 * Wird beim Self-Register und beim SMS-Einladungs-Versand verwendet,
 * damit dieselbe Nummer in beiden Wegen identisch in der DB landet.
 *
 * Leerstring-Input → leerer Output.
 */
export function normalizePhone(phone) {
  if (!phone) return ''
  let p = String(phone).replace(/[^\d+]/g, '')
  if (!p) return ''
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0') && !p.startsWith('+')) p = '+43' + p.slice(1)
  if (!p.startsWith('+')) p = '+43' + p
  return p
}

/**
 * Erzeugt aus einer Telefonnummer eine deterministische Pseudo-E-Mail-
 * Adresse, mit der Supabase Auth (das eine E-Mail braucht) intern arbeitet.
 *
 * Beispiel: "0664 1234567" → "+436641234567" → "436641234567@phone.local"
 *
 * .local ist eine reservierte Pseudo-TLD; die Adresse ist syntaktisch
 * gültig, aber niemals zustellbar – der Mitarbeiter sieht sie nie.
 */
export function phoneToPseudoEmail(phone) {
  const norm = normalizePhone(phone)
  if (!norm) return ''
  const digits = norm.replace(/\D/g, '')
  return `${digits}@phone.local`
}

/**
 * Erkennt, ob ein Eingabefeld eine E-Mail oder eine Telefonnummer ist.
 * Heuristik: enthält '@' → E-Mail.
 */
export function looksLikeEmail(input) {
  return typeof input === 'string' && input.includes('@')
}

/**
 * Konvertiert ein Login-Feld (Phone ODER E-Mail) in die für Supabase Auth
 * benötigte E-Mail. Gibt bei Fehlern den Roh-Wert zurück, damit die
 * Supabase-Fehlermeldung greift.
 */
export function loginIdentifierToEmail(input) {
  const v = String(input || '').trim()
  if (!v) return ''
  if (looksLikeEmail(v)) return v.toLowerCase()
  return phoneToPseudoEmail(v)
}
