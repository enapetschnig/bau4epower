import { supabase } from './supabase.js'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export async function loadAllUsers() {
  // Profile + Rolle
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ])
  if (pErr) throw pErr
  if (rErr) throw rErr

  const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]))
  return (profiles || []).map(p => ({
    ...p,
    role: roleMap.get(p.id) || 'mitarbeiter',
  }))
}

export async function activateUser(userId) {
  const adminId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('profiles').update({
    is_active: true,
    activated_at: new Date().toISOString(),
    activated_by: adminId,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
  }).eq('id', userId)
  if (error) throw error
}

export async function deactivateUser(userId, reason) {
  const adminId = (await supabase.auth.getUser()).data.user?.id
  const { error } = await supabase.from('profiles').update({
    is_active: false,
    deactivated_at: new Date().toISOString(),
    deactivated_by: adminId,
    deactivation_reason: reason || null,
  }).eq('id', userId)
  if (error) throw error
}

export async function setUserRole(userId, role) {
  // Alle bisherigen Rollen löschen, dann neue setzen
  await supabase.from('user_roles').delete().eq('user_id', userId)
  const { error } = await supabase.from('user_roles').insert({ user_id: userId, role })
  if (error) throw error
}

export async function setUserGewerk(userId, gewerk) {
  const { error } = await supabase.from('profiles').update({
    default_gewerk: gewerk,
  }).eq('id', userId)
  if (error) throw error
}

export async function loadUserStats(userId) {
  const [tEntries, projects] = await Promise.all([
    supabase.from('time_entries').select('id, datum, stunden').eq('user_id', userId),
    supabase.from('project_records').select('id').eq('created_by', userId),
  ])
  return {
    timeEntries: (tEntries.data || []).length,
    totalHours: (tEntries.data || []).reduce((s, e) => s + (Number(e.stunden) || 0), 0),
    projectsCreated: (projects.data || []).length,
  }
}

/**
 * Lädt alle Daten eines Users als ZIP herunter (für Archiv vor Löschung).
 * Erstellt eine Excel-Datei mit allen Stunden, Regiearbeiten und Materialien.
 */
export async function exportUserDataAsZip(user) {
  const userId = user.id
  const fullName = `${user.vorname || ''} ${user.nachname || ''}`.trim() || user.email || userId

  // Lade alle Daten
  const [tEntries, distEntries, materials, profile] = await Promise.all([
    supabase.from('time_entries').select('*, project_records(name, projekt_nummer)').eq('user_id', userId).order('datum'),
    supabase.from('disturbances').select('*, project_records(name, projekt_nummer)').eq('user_id', userId).order('datum'),
    supabase.from('material_entries').select('*, project_records(name, projekt_nummer)').eq('user_id', userId).order('created_at'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ])

  const wb = XLSX.utils.book_new()

  // Profil-Sheet
  const profileRows = [
    ['Stammdaten', ''],
    ['Vorname', profile.data?.vorname || ''],
    ['Nachname', profile.data?.nachname || ''],
    ['E-Mail', profile.data?.email || ''],
    ['Telefon', profile.data?.phone || ''],
    ['Default-Gewerk', profile.data?.default_gewerk || ''],
    ['Erstellt am', profile.data?.created_at || ''],
    ['Aktiviert am', profile.data?.activated_at || ''],
    ['Deaktiviert am', profile.data?.deactivated_at || ''],
  ]
  const wsProfile = XLSX.utils.aoa_to_sheet(profileRows)
  wsProfile['!cols'] = [{ wch: 20 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsProfile, 'Profil')

  // Stunden-Sheet
  const tRows = [['Datum', 'Projekt-Nr.', 'Projekt', 'Tätigkeit', 'Von', 'Bis', 'Pause min', 'Stunden', 'Ort', 'Abwesenheit']]
  for (const e of (tEntries.data || [])) {
    tRows.push([
      e.datum,
      e.project_records?.projekt_nummer || '',
      e.project_records?.name || '',
      e.taetigkeit || '',
      e.start_time || '',
      e.end_time || '',
      e.pause_minutes || 0,
      Number(e.stunden) || 0,
      e.location_type || '',
      e.is_absence ? e.absence_type : '',
    ])
  }
  const totalHours = (tEntries.data || []).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  tRows.push([])
  tRows.push(['', '', '', '', '', '', 'Gesamt:', Math.round(totalHours * 100) / 100])

  const wsT = XLSX.utils.aoa_to_sheet(tRows)
  wsT['!cols'] = [{wch:11},{wch:13},{wch:25},{wch:30},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:14}]
  XLSX.utils.book_append_sheet(wb, wsT, 'Zeiterfassung')

  // Regiearbeiten
  const dRows = [['Datum', 'Kunde', 'Adresse', 'Beschreibung', 'Stunden', 'Status', 'Verrechnet']]
  for (const d of (distEntries.data || [])) {
    dRows.push([
      d.datum,
      d.kunde_name || '',
      d.kunde_adresse || '',
      d.beschreibung || '',
      Number(d.stunden) || 0,
      d.status || '',
      d.is_verrechnet ? 'Ja' : 'Nein',
    ])
  }
  const wsD = XLSX.utils.aoa_to_sheet(dRows)
  wsD['!cols'] = [{wch:11},{wch:25},{wch:30},{wch:35},{wch:10},{wch:12},{wch:12}]
  XLSX.utils.book_append_sheet(wb, wsD, 'Regiearbeiten')

  // Material
  const mRows = [['Erstellt', 'Projekt', 'Material', 'Menge', 'Einheit', 'Notizen']]
  for (const m of (materials.data || [])) {
    mRows.push([
      m.created_at?.slice(0, 10) || '',
      m.project_records?.name || '',
      m.material || '',
      Number(m.menge) || 0,
      m.einheit || '',
      m.notizen || '',
    ])
  }
  const wsM = XLSX.utils.aoa_to_sheet(mRows)
  wsM['!cols'] = [{wch:11},{wch:25},{wch:30},{wch:10},{wch:10},{wch:30}]
  XLSX.utils.book_append_sheet(wb, wsM, 'Material')

  // Save Excel
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const dateStr = new Date().toISOString().slice(0, 10)
  const safeName = fullName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
  saveAs(blob, `Archiv_${safeName}_${dateStr}.xlsx`)
}

/**
 * Komplettes Löschen: User in auth.users wird via Service Role gelöscht.
 * Vorher ZIP-Export zur Archivierung.
 *
 * Da Frontend keinen direkten Zugriff auf Service Role hat, wird user_id Daten
 * stehen gelassen (Stunden, Projekte etc.) und Profile als gelöscht markiert.
 */
export async function deleteUserKeepData(userId, reason = 'Account gelöscht') {
  const adminId = (await supabase.auth.getUser()).data.user?.id

  // 1. User_roles entfernen → kein Login mehr möglich
  await supabase.from('user_roles').delete().eq('user_id', userId)

  // 2. Profil deaktivieren + als gelöscht markieren
  await supabase.from('profiles').update({
    is_active: false,
    deactivated_at: new Date().toISOString(),
    deactivated_by: adminId,
    deactivation_reason: reason,
  }).eq('id', userId)

  // Hinweis: Auth-User-Eintrag bleibt bestehen damit Foreign-Keys
  // (time_entries.user_id) intakt sind. Anmeldung blockiert über
  // is_active=false Check im Frontend.
}
