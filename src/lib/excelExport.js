import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function exportHoursToExcel({ entries, profiles, projects, monthLabel }) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Übersicht je Mitarbeiter
  const byUser = {}
  for (const e of entries) {
    const uid = e.user_id
    if (!byUser[uid]) byUser[uid] = []
    byUser[uid].push(e)
  }

  const overviewRows = [['Mitarbeiter', 'Arbeit (h)', 'Urlaub (h)', 'Krankenstand (h)', 'Sonstige (h)', 'Gesamt (h)']]
  for (const [uid, list] of Object.entries(byUser)) {
    const profile = profiles.find(p => p.id === uid)
    const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : uid
    const arbeit = list.filter(x => !x.is_absence).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const urlaub = list.filter(x => x.absence_type === 'Urlaub').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const krank = list.filter(x => x.absence_type === 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const sonst = list.filter(x => x.is_absence && x.absence_type !== 'Urlaub' && x.absence_type !== 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
    const total = arbeit + urlaub + krank + sonst
    overviewRows.push([name, arbeit, urlaub, krank, sonst, total])
  }
  const ws1 = XLSX.utils.aoa_to_sheet(overviewRows)
  ws1['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 17 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Übersicht Mitarbeiter')

  // Sheet 2: Detail-Einträge
  const detailRows = [['Datum', 'Mitarbeiter', 'Projekt', 'Tätigkeit', 'Von', 'Bis', 'Pause', 'Stunden', 'Art']]
  for (const e of entries) {
    const profile = profiles.find(p => p.id === e.user_id)
    const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : e.user_id
    const project = projects.find(p => p.id === e.project_id)
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
    ])
  }
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
  ws2['!cols'] = [
    { wch: 11 }, { wch: 22 }, { wch: 22 }, { wch: 28 },
    { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 9 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Details')

  // Sheet 3: Übersicht je Projekt
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

  // Save
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, `Stundenauswertung_${monthLabel}.xlsx`)
}
