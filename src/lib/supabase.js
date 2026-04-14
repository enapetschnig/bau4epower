import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Returns a fresh access_token, refreshing the session if necessary.
 * Use this instead of supabase.auth.getSession() before calling Edge Functions,
 * because getSession() may return an expired cached token.
 *
 * @returns {Promise<string>} valid access_token
 * @throws {Error} if not logged in or refresh fails
 */
export async function getFreshAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) throw new Error('Nicht angemeldet')

  // Check if token expires within the next 60 seconds
  const expiresAt = session.expires_at // unix timestamp in seconds
  const now = Math.floor(Date.now() / 1000)

  if (expiresAt && (expiresAt - now) < 60) {
    // Token is expired or about to expire → refresh
    const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
    if (error || !refreshed) {
      throw new Error('Sitzung abgelaufen – bitte neu anmelden')
    }
    return refreshed.access_token
  }

  return session.access_token
}

/**
 * Returns headers for calling Supabase Edge Functions.
 *
 * The anon key is now in "sb_publishable_..." format (new Supabase SDK) and is
 * no longer a valid JWT – so it cannot be used as Authorization Bearer anymore.
 *
 * Solution: Use the user's access_token as Authorization Bearer (valid JWT).
 * The apikey header still carries the anon key for the Supabase gateway.
 * The x-user-token header is kept for backwards compatibility with the Edge Function.
 *
 * @returns {Promise<Record<string, string>>} headers object
 */
export async function getEdgeFunctionHeaders() {
  const userToken = await getFreshAccessToken()
  return {
    'Authorization': `Bearer ${userToken}`,
    'apikey': supabaseAnonKey,
    'x-user-token': userToken,
  }
}

/** The Supabase anon key, exported for direct use where needed */
export const ANON_KEY = supabaseAnonKey
