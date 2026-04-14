import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtDecode } from 'https://esm.sh/jwt-decode@4'

const ALLOWED_ORIGINS = [
  'https://bau4you-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

// Rate limiting: 30 requests per minute per user
const rateLimitStore = new Map<string, number[]>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

function getCorsHeaders(origin: string) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-user-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitStore.get(userId) || []

  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS)

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    return false
  }

  validTimestamps.push(now)
  rateLimitStore.set(userId, validTimestamps)
  return true
}

function verifyUserToken(token: string): { userId: string } | null {
  try {
    const decoded = jwtDecode<{ sub: string; aud: string }>(token)
    if (!decoded.sub || decoded.aud !== 'authenticated') return null
    return { userId: decoded.sub }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user identity via custom header or Authorization header
    const userToken = req.headers.get('x-user-token')
      || req.headers.get('Authorization')?.replace('Bearer ', '') || ''

    const jwtData = verifyUserToken(userToken)
    if (!jwtData) {
      return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check rate limit
    if (!checkRateLimit(jwtData.userId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded: 30 requests per minute' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body = await req.json()
    const { model, system, messages, max_tokens, tools, thinking, anthropic_beta } = body

    if (!model || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'model and messages are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get API key from environment
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    // Prepare request payload
    const requestPayload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: max_tokens || 1024,
    }

    if (system) {
      requestPayload.system = system
    }

    if (tools) {
      requestPayload.tools = tools
    }

    if (thinking) {
      requestPayload.thinking = thinking
    }

    // Forward anthropic-beta header if provided
    const betaHeader = anthropic_beta || null

    // Forward to Anthropic API
    const anthropicHeaders: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
    if (betaHeader) {
      anthropicHeaders['anthropic-beta'] = betaHeader
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(requestPayload),
    })

    const responseData = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify(responseData), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
