import { supabase } from './supabase.js'

const DEFAULTS = {
  aufschlag_gesamt_prozent: 20,
  aufschlag_material_prozent: 30,
}

export async function loadSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
    if (error || !data) return { ...DEFAULTS }
    const result = { ...DEFAULTS }
    for (const row of data) {
      if (row.key in DEFAULTS) {
        result[row.key] = Number(row.value)
      }
    }
    return result
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSetting(key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value: String(value) }, { onConflict: 'key' })
  if (error) throw error
}
