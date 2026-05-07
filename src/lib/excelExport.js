import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function exportHoursToExcel({ entries, profiles, projects, zulagenList = [], monthLabel }) {
  const wb = XLSX.utils.book_new()

  // ─── Sheet 1: Übersicht je Mitarbeiter ───
  const byUser = {}
  for (const e of entries) {
    const uid = e.user_id
    if (!byUser[uid]) byUser[uid] = []
    byUser[uid].push(e)
  }

  // Zulagen pro User
  const zulagenByUser = {}
  for (const z of zulagenList) {
    const entry = entries.find(e => e.id === z.time_entry_id)
    if (!entry) continue
    if (!zulagenByUser[entry.user_id]) zulagenByUser[entry.user_id] = 0
    zulagenByUser[entry.user_id] += Number(z.betrag) || 0
  }

  const overviewRows = [['Mitarbeiter', 'Arbeit (h)', 'Urlaub (h)', 'Krankenstand (h)', 'Sonstige (h)', 'Gesamt (h)', 'Zulagen (€)']]
  for (const [uid, list] of Object.entries(byUser)) {
    const profile = profiles.find(p => p.id === uid)
    const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : uid
    const arbeit = list.filter(x => !x.is_absence).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const urlaub = list.filter(x => x.absence_type === 'Urlaub').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const krank = list.filter(x => x.absence_type === 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const sonst = list.filter(x => x.is_absence && x.absence_type !== 'Urlaub' && x.absence_type !== 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const total = arbeit + urlaub + krank + sonst
    const zsum = zulagenByUser[uid] || 0
    overviewRows.push([name, arbeit, urlaub, krank, sonst, total, Math.round(zsum * 100) / 100])
  }
  const ws1 = XLSX.utils.aoa_to_sheet(overviewRows)
  ws1['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 17 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Übersicht Mitarbeiter')

  // ─── Sheet 2: Detail-Einträge ───
  const detailRows = [['Datum', 'Mitarbeiter', 'Projekt', 'Tätigkeit', 'Von', 'Bis', 'Pause', 'Stunden', 'Art', 'Zulagen']]
  for (const e of entries) {
    const profile = profiles.find(p => p.id === e.user_id)
    const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : e.user_id
    const project = projects.find(p => p.id === e.project_id)
    const ezulagen = zulagenList.filter(z => z.time_entry_id === e.id)
    const zulagenStr = ezulagen.length > 0
      ? ezulagen.map(z => `${z.zulagen?.name || ''}: ${Number(z.betrag || 0).toFixed(2)}€`).join('; ')
      : ''
    detailRows.push([
      e.datum,
      name,
      project?.name || '',
      e.taetigkeit || '',
      e.start_time || '',
      e.end_time || '',
      e.pause_minutes || 0,
      Number(e.stunden) || 0,
      e.is_absence ? e.absence_type : 'Arbeit',
      zulagenStr,
    ])
  }
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
  ws2['!cols'] = [
    { wch: 11 }, { wch: 22 }, { wch: 22 }, { wch: 28 },
    { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 9 }, { wch: 14 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Details')

  // ─── Sheet 3: Übersicht je Projekt ───
  const byProject = {}
  for (const e of entries) {
    if (!e.project_id) continue
    if (!byProject[e.project_id]) byProject[e.project_id] = 0
    byProject[e.project_id] += Number(e.stunden) || 0
  }
  const projRows = [['Projekt', 'Stunden gesamt']]
  for (const [pid, sum] of Object.entries(byProject)) {
    const project = projects.find(p => p.id === pid)
    projRows.push([project?.name || pid, Math.round(sum * 100) / 100])
  }
  const ws3 = XLSX.utils.aoa_to_sheet(projRows)
  ws3['!cols'] = [{ wch: 30 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Projekte')

  // ─── Sheet 4: Zulagen ───
  if (zulagenList.length > 0) {
    const zRows = [['Datum', 'Mitarbeiter', 'Zulage', 'Menge', 'Betrag (€)', 'Notiz']]
    for (const z of zulagenList) {
      const entry = entries.find(e => e.id === z.time_entry_id)
      if (!entry) continue
      const profile = profiles.find(p => p.id === entry.user_id)
      const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : entry.user_id
      zRows.push([
        entry.datum,
        name,
        z.zulagen?.name || '',
        Number(z.menge) || 1,
        Math.round((Number(z.betrag) || 0) * 100) / 100,
        z.notiz || '',
      ])
    }
    // Summary row
    const totalSum = zulagenList.reduce((s, z) => s + (Number(z.betrag) || 0), 0)
    zRows.push(['', '', 'GESAMT', '', Math.round(totalSum * 100) / 100, ''])

    const ws4 = XLSX.utils.aoa_to_sheet(zRows)
    ws4['!cols'] = [{ wch: 11 }, { wch: 22 }, { wch: 25 }, { wch: 8 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws4, 'Zulagen')
  }

  // Save
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, `Stundenauswertung_${monthLabel}.xlsx`)
}
