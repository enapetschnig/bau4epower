/**
 * Vercel Serverless Function: SMS-Einladung via Twilio
 *
 * Wird vom Admin aufgerufen, um einen neuen Mitarbeiter per SMS einzuladen.
 *
 * Erwartet im Body: { invitationId, phone, vorname, code }
 *
 * Benötigte Vercel Environment Variables:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER (oder TWILIO_FROM_NUMBER)
 *   APP_URL (z.B. https://bau4epower.vercel.app)
 *   SUPABASE_SERVICE_ROLE_KEY (zum Aktualisieren der invitation)
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
  // Remove non-digits and ensure international format
  let p = String(phone).replace(/[^\d+]/g, '')
  // Wenn mit 00 → +
  if (p.startsWith('00')) p = '+' + p.slice(2)
  // Wenn mit 0 (Österreich Standard) → +43
  if (p.startsWith('0') && !p.startsWith('+')) p = '+43' + p.slice(1)
  // Wenn nichts vorne → +43 dazu
  if (!p.startsWith('+')) p = '+43' + p
  return p
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
    // Auth-Check
    const userToken = req.headers['x-user-token'] || ''
    const jwtData = decodeJwt(userToken)
    if (!jwtData) {
      return res.status(401).json({ error: 'Nicht angemeldet' })
    }

    const { invitationId, phone, vorname, code } = req.body || {}
    if (!invitationId || !phone || !code) {
      return res.status(400).json({ error: 'invitationId, phone und code erforderlich' })
    }

    // Twilio-Credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER
    const appUrl = process.env.APP_URL || 'https://bau4epower.vercel.app'

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({
        error: 'Twilio nicht konfiguriert. Bitte TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN und TWILIO_PHONE_NUMBER in Vercel setzen.',
      })
    }

    const toPhone = normalizePhone(phone)
    const registerUrl = `${appUrl}/register?code=${code}`
    const greeting = vorname ? `Hallo ${vorname}!` : 'Hallo!'
    const smsText = `${greeting} Das ist unsere neue ET-König-App. Bitte registriere dich hier: ${registerUrl}`

    // Twilio API Call
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

    // Invitation-Status updaten via Supabase REST API mit Service Role
    const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supaUrl && serviceKey) {
      const updatePayload = twilioRes.ok
        ? { status: 'sent', sms_sent_at: new Date().toISOString(), sms_error: null }
        : { status: 'pending', sms_error: twilioData.message || 'SMS-Versand fehlgeschlagen' }

      await fetch(`${supaUrl}/rest/v1/employee_invitations?id=eq.${invitationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(updatePayload),
      }).catch(() => {})
    }

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
