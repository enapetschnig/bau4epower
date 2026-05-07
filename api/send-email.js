/**
 * Vercel Serverless Function: E-Mail-Versand via SMTP (nodemailer).
 *
 * Liest die SMTP-Credentials zur Laufzeit aus app_settings (RLS „nur Admin")
 * — exakt nach demselben Muster wie send-sms-invite.js. So kann der Admin
 * Provider/Postfach wechseln, ohne Vercel-ENV oder Code anzufassen.
 *
 * Erwarteter Body (kompatibel zum bisherigen Make.com-Webhook-Schema):
 *   empfaenger / Empfanger : string  – Empfänger-Adresse
 *   Betreff               : string  – Betreff
 *   htmlBody              : string  – HTML-Body
 *   pdfBase64             : string  – Base64-PDF (optional)
 *   pdfDateiname / pdfFilename : string – Anhang-Dateiname
 */

import nodemailer from 'nodemailer'

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
    'Access-Control-Allow-Headers': 'content-type, x-user-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
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

    const body = req.body || {}
    const empfaenger = body.empfaenger || body.Empfanger
    const betreff = body.Betreff || body.betreff || ''
    const htmlBody = body.htmlBody || body.html || ''
    const textBody = body.textBody || body.text
    const pdfBase64 = body.pdfBase64
    const pdfFilename = body.pdfDateiname || body.pdfFilename || 'Anhang.pdf'

    if (!empfaenger) {
      return res.status(400).json({ error: 'empfaenger (E-Mail-Adresse) ist erforderlich' })
    }
    if (!htmlBody && !textBody) {
      return res.status(400).json({ error: 'htmlBody oder textBody erforderlich' })
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
      settings = await loadSettings(supaUrl, anonKey, userToken,
        ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'])
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }

    if (!settings.SMTP_HOST || !settings.SMTP_USER || !settings.SMTP_PASS) {
      return res.status(500).json({
        error: 'SMTP-Credentials fehlen in app_settings (SMTP_HOST, SMTP_USER, SMTP_PASS).',
      })
    }

    const transporter = nodemailer.createTransport({
      host: settings.SMTP_HOST,
      port: parseInt(settings.SMTP_PORT || '465', 10),
      secure: String(settings.SMTP_SECURE || 'true').toLowerCase() === 'true',
      auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASS },
    })

    const mail = {
      from: settings.SMTP_FROM || settings.SMTP_USER,
      to: empfaenger,
      subject: betreff,
      ...(htmlBody ? { html: htmlBody } : {}),
      ...(textBody ? { text: textBody } : {}),
    }

    if (pdfBase64) {
      mail.attachments = [{
        filename: pdfFilename,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf',
      }]
    }

    const info = await transporter.sendMail(mail)

    return res.status(200).json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })

  } catch (err) {
    console.error('send-email Fehler:', err)
    return res.status(500).json({
      error: err.message || 'Unknown error',
      code: err.code,
      command: err.command,
    })
  }
}
