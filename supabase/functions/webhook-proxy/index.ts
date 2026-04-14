import { jwtDecode } from 'https://esm.sh/jwt-decode@4'

const ALLOWED_ORIGINS = [
  'https://bau4you-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

function getCorsHeaders(origin: string) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-user-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
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

    const user = verifyUserToken(userToken)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get webhook URL from environment
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL')
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL not configured')
    }

    // Parse request body
    const body = await req.json()

    // Forward to webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // Make.com webhooks often return plain text ("Accepted") instead of JSON
    const responseText = await response.text()
    let responseData: unknown
    try {
      responseData = JSON.parse(responseText)
    } catch {
      // Plain text response (e.g. "Accepted") – wrap as JSON
      responseData = { status: 'ok', message: responseText }
    }

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
// last deployed: needs redeployment for ES256 JWT fix
