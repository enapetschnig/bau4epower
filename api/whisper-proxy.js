/**
 * Vercel Serverless Function: Whisper API Proxy
 * Ersetzt die Supabase Edge Function, da das Supabase Gateway
 * den neuen sb_publishable-Anon-Key nicht als JWT akzeptiert.
 *
 * - Verifiziert User-Identity via JWT-Decode
 * - Leitet Audio an OpenAI Whisper API weiter
 * - Gibt Transkription zurück
 *
 * Benötigte Vercel Environment Variable:
 *   OPENAI_API_KEY oder VITE_OPENAI_API_KEY
 */

export const config = {
  api: {
    bodyParser: false, // We need raw body for multipart/form-data
  },
}

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

// Read raw body as Buffer
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
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
    // Verify user identity
    const userToken = req.headers['x-user-token']
      || req.headers['authorization']?.replace('Bearer ', '') || ''
    const jwtData = decodeJwt(userToken)
    if (!jwtData) {
      return res.status(401).json({ error: 'Nicht angemeldet' })
    }

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
    }

    // Read raw body and forward as-is to OpenAI
    const rawBody = await getRawBody(req)
    const contentType = req.headers['content-type'] || ''

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentType,
      },
      body: rawBody,
    })

    const data = await response.json()
    return res.status(response.status).json(data)

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
