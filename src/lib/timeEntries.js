import { supabase } from './supabase.js'

export async function loadMyTimeEntries(userId, { from, to } = {}) {
  let query = supabase
    .from('time_entries')
    .select('*, project_records(id, name)')
    .eq('user_id', userId)
    .order('datum', { ascending: false })
  if (from) query = query.gte('datum', from)
  if (to) query = query.lte('datum', to)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createTimeEntry({
  userId, projectId, datum, taetigkeit, stunden,
  startTime, endTime, pauseMinutes, locationType, notizen,
  isAbsence, absenceType,
}) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: userId,
      project_id: projectId || null,
      datum,
      taetigkeit: taetigkeit || '',
      stunden: stunden || 0,
      start_time: startTime || null,
      end_time: endTime || null,
      pause_minutes: pauseMinutes || 0,
      location_type: locationType || 'baustelle',
      notizen: notizen || '',
      is_absence: !!isAbsence,
      absence_type: absenceType || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTimeEntry(id, updates) {
  const { error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteTimeEntry(id) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
  if (error) throw error
}
