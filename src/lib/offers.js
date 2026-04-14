import { supabase } from './supabase.js'

// Strip React-internal fields before saving to DB
function cleanGewerke(gewerke) {
  return (gewerke || []).map(g => ({
    ...g,
    positionen: (g.positionen || []).map(({ previousState: _, _rev: __, ...p }) => p),
  }))
}

export async function saveOffer({ userId, erstellerName, betrifft, projektnummer, eingabeText, angebotData, ergaenzungen = [], hinweise = [] }) {
  const cleaned = {
    ...angebotData,
    gewerke: cleanGewerke(angebotData.gewerke),
    _ersteller_name: erstellerName || '',
  }
  const { data, error } = await supabase
    .from('offers')
    .insert({
      created_by: userId,
      betrifft: betrifft || angebotData.betreff || '',
      hero_projektnummer: projektnummer || '',
      eingabe_text: eingabeText || null,
      angebot_data: cleaned,
      ergaenzungen: ergaenzungen || [],
      hinweise: hinweise || [],
      status: 'entwurf',
      gesamtsumme_netto: angebotData.netto || 0,
      gesamtsumme_brutto: angebotData.brutto || 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadOffer(id) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateErgaenzungen(id, ergaenzungen) {
  const { error } = await supabase.from('offers').update({ ergaenzungen: ergaenzungen || [] }).eq('id', id)
  if (error) throw error
}

export async function updateHinweise(id, hinweise) {
  const { error } = await supabase.from('offers').update({ hinweise: hinweise || [] }).eq('id', id)
  if (error) throw error
}

export async function loadOffers(userId, isAdmin) {
  let query = supabase
    .from('offers')
    .select('id, created_at, betrifft, hero_projektnummer, status, gesamtsumme_netto, gesamtsumme_brutto, created_by, bauleiter_id, angebot_data, ergaenzungen, hinweise, offer_media(count)')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.or(`created_by.eq.${userId},bauleiter_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updateOffer(id, { betrifft, angebotData, ergaenzungen, hinweise }) {
  const cleaned = {
    ...angebotData,
    gewerke: cleanGewerke(angebotData.gewerke),
  }
  const payload = {
    betrifft: betrifft || '',
    angebot_data: cleaned,
    gesamtsumme_netto: angebotData.netto || 0,
    gesamtsumme_brutto: angebotData.brutto || 0,
  }
  // Ergänzungen/Hinweise nur mitschicken wenn übergeben (undefined = nicht ändern)
  if (ergaenzungen !== undefined) payload.ergaenzungen = ergaenzungen || []
  if (hinweise !== undefined) payload.hinweise = hinweise || []
  const { error } = await supabase
    .from('offers')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

/**
 * Upsert: Wenn id vorhanden → update, sonst → insert.
 * Gibt { id, isNew } zurück.
 */
export async function upsertOffer(existingId, offerPayload) {
  if (existingId) {
    await updateOffer(existingId, offerPayload)
    return { id: existingId, isNew: false }
  }
  const data = await saveOffer(offerPayload)
  return { id: data.id, isNew: true }
}

export async function updateOfferStatus(id, status) {
  const { error } = await supabase.from('offers').update({ status }).eq('id', id)
  if (error) throw error
}

export async function assignBauleiter(id, bauleiterId) {
  const { error } = await supabase
    .from('offers')
    .update({ bauleiter_id: bauleiterId, status: 'gesendet' })
    .eq('id', id)
  if (error) throw error
}

export async function deleteOffer(id) {
  const { error } = await supabase.from('offers').delete().eq('id', id)
  if (error) throw error
}

export async function loadBauleiter() {
  try {
    const { data, error } = await supabase.from('users').select('*')
    if (error) throw error
    const rows = (data || []).map(u => ({
      id: u.id,
      name: u.name || u.full_name || u.display_name || u.email || '',
      email: u.email || '',
      role: u.role || '',
    }))
    console.log('[loadBauleiter] DB-Ergebnis:', rows.length, 'Einträge')
    return rows
  } catch (err) {
    console.warn('[loadBauleiter] DB nicht erreichbar (RLS?), nutze Fallback:', err.message)
    return []
  }
}
