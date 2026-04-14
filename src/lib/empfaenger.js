import { supabase } from './supabase.js'

export async function loadEmpfaenger(userId) {
  try {
    const { data } = await supabase
      .from('empfaenger')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    return data || []
  } catch {
    return []
  }
}

export async function saveEmpfaenger(userId, email, name = null) {
  try {
    const trimmed = email.toLowerCase().trim()
    // Prüfen ob bereits vorhanden
    const { data: existing } = await supabase
      .from('empfaenger')
      .select('id')
      .eq('email', trimmed)
      .eq('created_by', userId)
      .maybeSingle()
    if (existing) return existing
    const { data, error } = await supabase
      .from('empfaenger')
      .insert({ created_by: userId, email: trimmed, name: name || null })
      .select()
      .single()
    if (error) throw error
    return data
  } catch {
    // Fehler beim Speichern ignorieren – nicht kritisch
  }
}

export async function deleteEmpfaenger(id) {
  const { error } = await supabase.from('empfaenger').delete().eq('id', id)
  if (error) throw error
}
