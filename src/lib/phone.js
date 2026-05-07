/**
 * Normalisiert eine Telefonnummer ins österreichische E.164-Format (+43…).
 * Wird beim Self-Register und beim SMS-Einladungs-Versand verwendet,
 * damit dieselbe Nummer in beiden Wegen identisch in der DB landet
 * (sonst wären "+43664…" und "0664…" zwei verschiedene Strings).
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
