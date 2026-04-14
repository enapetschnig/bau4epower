import { jwtDecode } from 'https://esm.sh/jwt-decode@4'

const ALLOWED_ORIGINS = [
  'https://bau4epower.vercel.app',
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
    // Supports both old (Authorization Bearer <user-jwt>) and new (x-user-token) patterns
    const userToken = req.headers.get('x-user-token')
      || req.headers.get('Authorization')?.replace('Bearer ', '') || ''

    const user = verifyUserToken(userToken)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get API key from environment
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Parse FormData
    const formData = await req.formData()
    const audioFile = formData.get('file')

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Audio file is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create new FormData for OpenAI API
    const openaiFormData = new FormData()
    openaiFormData.append('file', audioFile)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('language', 'de')

    // Forward prompt if provided
    const prompt = formData.get('prompt')
    if (prompt && typeof prompt === 'string') {
      openaiFormData.append('prompt', prompt)
    }

    // Forward to OpenAI API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openaiFormData,
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
// last deployed: needs redeployment for ES256 JWT fix
