import { supabase } from './supabase.js'

export async function loadTemplates() {
  const { data, error } = await supabase
    .from('input_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveTemplate({ userId, name, inputText, type }) {
  const { data, error } = await supabase
    .from('input_templates')
    .insert({
      created_by: userId,
      name,
      type,
      template_data: { inputText },
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTemplate(id, { name, inputText }) {
  const { error } = await supabase
    .from('input_templates')
    .update({ name, template_data: { inputText } })
    .eq('id', id)
  if (error) throw error
}

export async function renameTemplate(id, name) {
  const { error } = await supabase
    .from('input_templates')
    .update({ name })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id) {
  const { error } = await supabase
    .from('input_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}
