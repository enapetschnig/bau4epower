/**
 * Vercel Serverless Function: Claude API Proxy
 * Ersetzt die Supabase Edge Function, da das Supabase Gateway
 * ES256-JWTs nicht mehr akzeptiert.
 *
 * - Verifiziert User-Identity via JWT-Decode (gleich wie vorher)
 * - Rate Limiting: 30 Requests/Minute pro User
 * - Leitet Anfragen an Anthropic API weiter
 */

// Simple JWT decode (no verification - same as Supabase edge function)
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

// In-memory rate limiting (resets when function cold-starts)
const rateLimitStore = new Map()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function checkRateLimit(userId) {
  const now = Date.now()
  const timestamps = rateLimitStore.get(userId) || []
  const valid = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)
  if (valid.length >= RATE_LIMIT_MAX) return false
  valid.push(now)
  rateLimitStore.set(userId, valid)
  return true
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

    // Rate limit
    if (!checkRateLimit(jwtData.userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded: 30 requests per minute' })
    }

    // Parse body
    const { model, system, messages, max_tokens, tools, thinking, anthropic_beta } = req.body

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'model and messages are required' })
    }

    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    // Build request
    const payload = { model, messages, max_tokens: max_tokens || 1024 }
    if (system) payload.system = system
    if (tools) payload.tools = tools
    if (thinking) payload.thinking = thinking

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
    if (anthropic_beta) headers['anthropic-beta'] = anthropic_beta

    // Forward to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    return res.status(response.status).json(data)

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' })
  }
}
