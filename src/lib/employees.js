import { supabase } from './supabase.js'

export async function loadEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('nachname')
  if (error) throw error
  return data || []
}

export async function createEmployee(data) {
  const { data: result, error } = await supabase
    .from('employees')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function updateEmployee(id, updates) {
  const { error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) throw error
}
