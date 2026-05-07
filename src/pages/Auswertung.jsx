import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { ChartLine, FileXls, SpinnerGap, Calendar, Coin } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { supabase } from '../lib/supabase.js'
import { loadProjects } from '../lib/projectRecords.js'
import { loadZulagenForEntries } from '../lib/zulagen.js'
import { exportHoursToExcel } from '../lib/excelExport.js'

export default function Auswertung() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState('mitarbeiter')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [entries, setEntries] = useState([])
  const [profiles, setProfiles] = useState([])
  const [projects, setProjects] = useState([])
  const [zulagenList, setZulagenList] = useState([])
  const [loading, setLoading] = useState(true)

  if (!isAdmin) return <Navigate to="/" replace />

  useEffect(() => {
    loadData()
  }, [month])

  async function loadData() {
    setLoading(true)
    try {
      const [year, m] = month.split('-')
      const from = `${year}-${m}-01`
      const lastDay = new Date(year, parseInt(m), 0).getDate()
      const to = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

      const [entriesRes, profilesRes, projs] = await Promise.all([
        supabase.from('time_entries').select('*').gte('datum', from).lte('datum', to).order('datum'),
        supabase.from('profiles').select('*'),
        loadProjects(),
      ])
      if (entriesRes.error) throw entriesRes.error
      const entriesData = entriesRes.data || []
      setEntries(entriesData)
      setProfiles(profilesRes.data || [])
      setProjects(projs)

      // Zulagen für alle Einträge laden
      if (entriesData.length > 0) {
        const z = await loadZulagenForEntries(entriesData.map(e => e.id))
        setZulagenList(z)
      } else {
        setZulagenList([])
      }
    } catch (err) {
      showToast(err.message || 'Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    try {
      exportHoursToExcel({ entries, profiles, projects, zulagenList, monthLabel: month })
      showToast('Excel-Export erstellt')
    } catch (err) {
      showToast(err.message || 'Export fehlgeschlagen', 'error')
    }
  }

  // Aggregations
  const byUser = {}
  for (const e of entries) {
    if (!byUser[e.user_id]) byUser[e.user_id] = []
    byUser[e.user_id].push(e)
  }

  const zulagenByUser = {}
  for (const z of zulagenList) {
    const entry = entries.find(e => e.id === z.time_entry_id)
    if (!entry) continue
    if (!zulagenByUser[entry.user_id]) zulagenByUser[entry.user_id] = []
    zulagenByUser[entry.user_id].push(z)
  }

  const byProject = {}
  for (const e of entries) {
    if (!e.project_id) continue
    if (!byProject[e.project_id]) byProject[e.project_id] = 0
    byProject[e.project_id] += Number(e.stunden) || 0
  }

  const totalArbeit = entries.filter(x => !x.is_absence).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const totalUrlaub = entries.filter(x => x.absence_type === 'Urlaub').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const totalKrank = entries.filter(x => x.absence_type === 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const totalZulagen = zulagenList.reduce((s, z) => s + (Number(z.betrag) || 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="text-lg font-bold text-secondary">Stundenauswertung</h1>
        <div className="flex items-center gap-2">
          <input type="month" value={month}
            onChange={e => setMonth(e.target.value)}
            className="input-field max-w-[140px]" />
          <button onClick={handleExport} disabled={loading || entries.length === 0}
            className="btn-primary px-3">
            <FileXls size={13} weight="fill" />
            Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="card text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Arbeit</p>
          <p className="text-lg font-bold text-primary mt-0.5">{totalArbeit.toFixed(1)}h</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Urlaub</p>
          <p className="text-lg font-bold text-amber-500 mt-0.5">{totalUrlaub.toFixed(1)}h</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Krank</p>
          <p className="text-lg font-bold text-rose-500 mt-0.5">{totalKrank.toFixed(1)}h</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Zulagen</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">{totalZulagen.toFixed(2)}€</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px bg-gray-100 rounded-md p-0.5 mb-3 overflow-x-auto">
        {[
          { v: 'mitarbeiter', l: 'Mitarbeiter' },
          { v: 'projekte', l: 'Projekte' },
          { v: 'zulagen', l: 'Zulagen' },
          { v: 'details', l: 'Details' },
        ].map(t => (
          <button key={t.v}
            onClick={() => setTab(t.v)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all whitespace-nowrap
              ${tab === t.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerGap size={28} className="animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-[13px] text-gray-400">Keine Einträge in diesem Monat</p>
        </div>
      ) : tab === 'mitarbeiter' ? (
        <div className="space-y-1.5">
          {Object.entries(byUser).map(([uid, list]) => {
            const profile = profiles.find(p => p.id === uid)
            const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : uid
            const arbeit = list.filter(x => !x.is_absence).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
            const urlaub = list.filter(x => x.absence_type === 'Urlaub').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
            const krank = list.filter(x => x.absence_type === 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
            const total = list.reduce((s, e) => s + (Number(e.stunden) || 0), 0)
            const userZulagen = zulagenByUser[uid] || []
            const zulagenSum = userZulagen.reduce((s, z) => s + (Number(z.betrag) || 0), 0)
            return (
              <div key={uid} className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-secondary truncate">{name}</p>
                  <div className="text-right">
                    <span className="text-[13px] font-bold text-primary">{total.toFixed(1)}h</span>
                    {zulagenSum > 0 && (
                      <span className="text-[11px] text-emerald-600 ml-2">+ {zulagenSum.toFixed(2)} €</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="text-center">
                    <p className="text-gray-400">Arbeit</p>
                    <p className="font-semibold text-secondary">{arbeit.toFixed(1)}h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Urlaub</p>
                    <p className="font-semibold text-amber-500">{urlaub.toFixed(1)}h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Krank</p>
                    <p className="font-semibold text-rose-500">{krank.toFixed(1)}h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">Zulagen</p>
                    <p className="font-semibold text-emerald-600">{zulagenSum.toFixed(2)}€</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : tab === 'projekte' ? (
        <div className="space-y-1.5">
          {Object.entries(byProject)
            .sort(([, a], [, b]) => b - a)
            .map(([pid, sum]) => {
              const project = projects.find(p => p.id === pid)
              return (
                <div key={pid} className="bg-white rounded-lg border border-gray-100 p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-secondary truncate">{project?.name || 'Unbekannt'}</p>
                    {project?.adresse && <p className="text-[11px] text-gray-400 truncate">{project.adresse}</p>}
                  </div>
                  <span className="text-[13px] font-bold text-primary">{sum.toFixed(1)}h</span>
                </div>
              )
            })}
          {Object.keys(byProject).length === 0 && (
            <p className="text-center py-8 text-[13px] text-gray-400">Keine Projekt-Stunden in diesem Monat</p>
          )}
        </div>
      ) : tab === 'zulagen' ? (
        <ZulagenView zulagenList={zulagenList} entries={entries} profiles={profiles} />
      ) : (
        <div className="space-y-1">
          {entries.map(e => {
            const profile = profiles.find(p => p.id === e.user_id)
            const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : '–'
            const project = projects.find(p => p.id === e.project_id)
            const ezulagen = zulagenList.filter(z => z.time_entry_id === e.id)
            return (
              <div key={e.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-start gap-2">
                <span className="text-[10px] text-gray-400 w-12 flex-shrink-0 mt-0.5">{formatDate(e.datum)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-secondary truncate">{name}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {e.is_absence ? e.absence_type : (project?.name || 'Ohne Projekt')}
                    {e.taetigkeit ? ` · ${e.taetigkeit}` : ''}
                  </p>
                  {ezulagen.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ezulagen.map(z => (
                        <span key={z.id} className="text-[9px] bg-amber-50 text-amber-700 px-1 py-px rounded">
                          {z.zulagen?.name}: {Number(z.betrag).toFixed(2)}€
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[12px] font-bold text-primary flex-shrink-0">{Number(e.stunden).toFixed(2)}h</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ZulagenView({ zulagenList, entries, profiles }) {
  // Group by zulage type
  const byType = {}
  for (const z of zulagenList) {
    const name = z.zulagen?.name || 'Unbekannt'
    if (!byType[name]) byType[name] = { name, einheit: z.zulagen?.einheit || 'EUR', total: 0, count: 0, mengeTotal: 0 }
    byType[name].total += Number(z.betrag) || 0
    byType[name].count += 1
    byType[name].mengeTotal += Number(z.menge) || 1
  }

  // Per user breakdown
  const byUser = {}
  for (const z of zulagenList) {
    const entry = entries.find(e => e.id === z.time_entry_id)
    if (!entry) continue
    const profile = profiles.find(p => p.id === entry.user_id)
    const name = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() || profile.email : entry.user_id
    if (!byUser[name]) byUser[name] = { name, total: 0, byType: {} }
    byUser[name].total += Number(z.betrag) || 0
    const tname = z.zulagen?.name || 'Unbekannt'
    if (!byUser[name].byType[tname]) byUser[name].byType[tname] = 0
    byUser[name].byType[tname] += Number(z.betrag) || 0
  }

  if (zulagenList.length === 0) {
    return (
      <div className="text-center py-8">
        <Coin size={32} className="mx-auto mb-2 text-gray-200" />
        <p className="text-[13px] text-gray-400">Keine Zulagen in diesem Monat</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[12px] font-semibold text-secondary mb-2 px-1">Nach Zulagen-Typ</h3>
        <div className="space-y-1.5">
          {Object.values(byType).sort((a, b) => b.total - a.total).map(t => (
            <div key={t.name} className="bg-white rounded-lg border border-gray-100 p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-secondary truncate">{t.name}</p>
                <p className="text-[10px] text-gray-400">
                  {t.count} {t.count === 1 ? 'Eintrag' : 'Einträge'}
                  {' · '}{t.mengeTotal.toLocaleString('de-AT', { minimumFractionDigits: 1 })} Mengen-Einheiten
                </p>
              </div>
              <span className="text-[13px] font-bold text-emerald-600">
                {t.total.toLocaleString('de-AT', { minimumFractionDigits: 2 })} {t.einheit?.startsWith('EUR') ? '€' : t.einheit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[12px] font-semibold text-secondary mb-2 px-1">Nach Mitarbeiter</h3>
        <div className="space-y-1.5">
          {Object.values(byUser).sort((a, b) => b.total - a.total).map(u => (
            <div key={u.name} className="bg-white rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-semibold text-secondary truncate">{u.name}</p>
                <span className="text-[13px] font-bold text-emerald-600">{u.total.toFixed(2)} €</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(u.byType).sort(([, a], [, b]) => b - a).map(([n, b]) => (
                  <span key={n} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-px rounded">
                    {n}: {b.toFixed(2)}€
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
}
