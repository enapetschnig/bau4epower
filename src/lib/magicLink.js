import { supabase } from './supabase.js'

/**
 * Generates a Supabase magic link for the given email that redirects to the given URL.
 * Uses the generate-magic-link Edge Function (Service Role Key is server-side only).
 * Falls back to the plain URL if the Edge Function fails.
 */
export async function generateMagicLink(email, redirectTo) {
  const { data, error } = await supabase.functions.invoke('generate-magic-link', {
    body: { email, redirectTo },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.link
}
