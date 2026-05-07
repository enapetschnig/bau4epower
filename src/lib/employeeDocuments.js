import { supabase } from './supabase.js'

export const DOC_CATEGORIES = [
  { v: 'lohnzettel', l: 'Lohnzettel' },
  { v: 'krankmeldung', l: 'Krankmeldung' },
  { v: 'vertrag', l: 'Vertrag' },
  { v: 'sonstiges', l: 'Sonstiges' },
]

export async function loadMyDocuments(userId) {
  const { data, error } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadEmployeeDocuments(employeeId) {
  const { data, error } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employeeId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadEmployeeDocument({ userId, employeeId, category, file }) {
  const adminId = (await supabase.auth.getUser()).data.user?.id
  const ext = file.name.split('.').pop() || 'pdf'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${userId || employeeId}/${safeName}`

  const { error: upErr } = await supabase.storage
    .from('employee-documents')
    .upload(path, file)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('employee_documents')
    .insert({
      user_id: userId || null,
      employee_id: employeeId || null,
      category,
      file_name: file.name,
      file_url: path,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: adminId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDocumentUrl(doc) {
  const { data, error } = await supabase.storage
    .from('employee-documents')
    .createSignedUrl(doc.file_url, 3600)
  if (error) throw error
  return data?.signedUrl
}

export async function deleteEmployeeDocument(doc) {
  await supabase.storage.from('employee-documents').remove([doc.file_url])
  const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id)
  if (error) throw error
}
