/**
 * Vercel Serverless Function: SMS-Einladung via Twilio
 *
 * Wird vom Admin aufgerufen, um einen neuen Mitarbeiter per SMS einzuladen.
 *
 * Erwartet im Body: { invitationId, phone, vorname, code }
 *
 * Twilio-Credentials werden NICHT aus Vercel-ENV gelesen, sondern aus der
 * Supabase-Tabelle app_settings (RLS „nur Admin"). Die Function fragt sie
 * mit dem User-JWT des aufrufenden Admins ab – so kann der Admin in der
 * App jederzeit Twilio-Account, -Token oder -Nummer wechseln, ohne dass
 * Vercel-Variablen angefasst und ein Redeploy nötig wäre.
 */

function decodeJwt(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    )
    if (!payload.sub || payload.aud !== 'authenticated') return null
    return { userId: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

const ALLOWED_ORIGINS = [
  'https://bau4epower.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'content-type, x-user-token, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function normalizePhone(phone) {
  let p = String(phone).replace(/[^\d+]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0') && !p.startsWith('+')) p = '+43' + p.slice(1)
  if (!p.startsWith('+')) p = '+43' + p
  return p
}

async function loadSettings(supaUrl, anonKey, userToken, keys) {
  const params = new URLSearchParams()
  params.set('select', 'key,value')
  params.set('key', `in.(${keys.join(',')})`)

  const res = await fetch(`${supaUrl}/rest/v1/app_settings?${params}`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${userToken}`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`app_settings konnten nicht geladen werden (HTTP ${res.status}): ${txt}`)
  }
  const rows = await res.json()
  const map = {}
  for (const r of rows) map[r.key] = r.value
  return map
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))

  try {
    const userToken = req.headers['x-user-token'] || ''
    const jwtData = decodeJwt(userToken)
    if (!jwtData) {
      return res.status(401).json({ error: 'Nicht angemeldet' })
    }

    const { invitationId, phone, vorname, code } = req.body || {}
    if (!invitationId || !phone || !code) {
      return res.status(400).json({ error: 'invitationId, phone und code erforderlich' })
    }

    const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    if (!supaUrl || !anonKey) {
      return res.status(500).json({
        error: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen in der Vercel-Konfiguration.',
      })
    }

    let settings
    try {
      settings = await loadSettings(
        supaUrl, anonKey, userToken,
        ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'APP_URL'],
      )
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }

    const accountSid = settings.TWILIO_ACCOUNT_SID
    const authToken = settings.TWILIO_AUTH_TOKEN
    const fromNumber = settings.TWILIO_PHONE_NUMBER
    const appUrl = settings.APP_URL || 'https://bau4epower.vercel.app'

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({
        error: 'Twilio-Credentials fehlen in app_settings (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).',
      })
    }

    const toPhone = normalizePhone(phone)
    const registerUrl = `${appUrl}/register?code=${code}`
    const greeting = vorname ? `Hallo ${vorname}!` : 'Hallo!'
    const smsText = `${greeting} Das ist unsere neue ET-König-App. Bitte registriere dich hier: ${registerUrl}`

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const formBody = new URLSearchParams({
      To: toPhone,
      From: fromNumber,
      Body: smsText,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      return res.status(twilioRes.status).json({
        error: `Twilio-Fehler: ${twilioData.message || 'Unbekannt'}`,
        details: twilioData,
      })
    }

    return res.status(200).json({
      ok: true,
      to: toPhone,
      messageId: twilioData.sid,
      registerUrl,
    })

  } catch (err) {
    console.error('SMS-Invite Fehler:', err)
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
