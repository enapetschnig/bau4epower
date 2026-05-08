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

// Domain für die intern erzeugten Pseudo-E-Mails der Phone-Logins.
// Subdomain einer von uns kontrollierten Domain, ohne MX-Eintrag → niemals
// zustellbar. Supabase Auth lehnt reservierte Pseudo-TLDs wie ".local"
// als "email_address_invalid" ab; eine echte Domain unter unserer
// Kontrolle akzeptiert es problemlos.
export const PHONE_EMAIL_DOMAIN = 'phone.bau4epower.app'

/**
 * Erzeugt aus einer Telefonnummer eine deterministische Pseudo-E-Mail.
 *
 * Beispiel: "0664 1234567" → "+436641234567" → "436641234567@phone.bau4epower.app"
 */
export function phoneToPseudoEmail(phone) {
  const norm = normalizePhone(phone)
  if (!norm) return ''
  const digits = norm.replace(/\D/g, '')
  return `${digits}@${PHONE_EMAIL_DOMAIN}`
}

/**
 * Prüft, ob eine Adresse eine intern erzeugte Phone-Pseudo-Mail ist.
 */
export function isPhonePseudoEmail(email) {
  return typeof email === 'string' && email.endsWith('@' + PHONE_EMAIL_DOMAIN)
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
