/**
 * Vercel Serverless Function: Email-Versand via Make.com Webhook
 * Ersetzt die Supabase Edge Function (webhook-proxy), da das Supabase Gateway
 * den neuen sb_publishable-Anon-Key nicht mehr als JWT akzeptiert.
 *
 * - Verifiziert User-Identity via JWT-Decode (gleich wie claude-proxy.js)
 * - Leitet den Request an Make.com Webhook weiter
 * - Make.com versendet dann die E-Mail mit PDF-Anhang
 *
 * Benötigte Vercel Environment Variable:
 *   MAKE_WEBHOOK_URL – Die Make.com Webhook-URL
 */

// Simple JWT decode (no verification - same pattern as claude-proxy.js)
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
  'https://bau4you-app.vercel.app',
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

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Set CORS headers
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))

  try {
    // Verify user identity via x-user-token header
    const userToken = req.headers['x-user-token'] || ''
    const jwtData = decodeJwt(userToken)
    if (!jwtData) {
      return res.status(401).json({ error: 'Nicht angemeldet' })
    }

    // Get Make.com webhook URL (check both names)
    const webhookUrl = process.env.MAKE_WEBHOOK_URL || process.env.VITE_MAKE_WEBHOOK_URL
    if (!webhookUrl) {
      return res.status(500).json({ error: 'MAKE_WEBHOOK_URL not configured' })
    }

    // Parse and forward request body to Make.com
    const body = req.body
    if (!body || !body.empfaenger) {
      return res.status(400).json({ error: 'empfaenger (E-Mail-Adresse) ist erforderlich' })
    }

    // Forward to Make.com webhook (always JSON)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    // Make.com webhooks often return plain text ("Accepted") instead of JSON
    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { status: 'ok', message: responseText }
    }

    if (!response.ok) {
      return res.status(response.status).json(responseData)
    }

    return res.status(200).json(responseData)

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
