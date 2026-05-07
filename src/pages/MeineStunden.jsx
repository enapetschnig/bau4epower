import { useState, useEffect } from 'react'
import { Clock, Calendar, SpinnerGap } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadMyTimeEntries, deleteTimeEntry } from '../lib/timeEntries.js'

export default function MeineStunden() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const [year, m] = month.split('-')
    const from = `${year}-${m}-01`
    const to = `${year}-${m}-31`
    loadMyTimeEntries(user.id, { from, to })
      .then(setEntries)
      .catch(() => showToast('Daten konnten nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  }, [user, month])

  const totalArbeit = entries.filter(e => !e.is_absence).reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const totalUrlaub = entries.filter(e => e.absence_type === 'Urlaub').reduce((s, e) => s + (Number(e.stunden) || 0), 0)
  const totalKrank = entries.filter(e => e.absence_type === 'Krankenstand').reduce((s, e) => s + (Number(e.stunden) || 0), 0)

  const grouped = entries.reduce((acc, e) => {
    const key = e.datum
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-secondary">Meine Stunden</h1>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="input-field max-w-[140px]"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
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
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <SpinnerGap size={24} className="animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-400">
          <Calendar size={32} className="mx-auto mb-2 text-gray-200" />
          Keine Einträge in diesem Monat
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([date, items]) => {
            const daySum = items.reduce((s, e) => s + (Number(e.stunden) || 0), 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[11px] font-semibold text-secondary">{formatLongDate(date)}</p>
                  <p className="text-[11px] text-gray-400">{daySum.toFixed(2)}h</p>
                </div>
                <div className="space-y-1">
                  {items.map(e => (
                    <div key={e.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {e.is_absence ? (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-px rounded">{e.absence_type}</span>
                            ) : e.project_records ? (
                              <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-px rounded truncate max-w-[150px]">
                                {e.project_records.name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">Ohne Projekt</span>
                            )}
                          </div>
                          {e.taetigkeit && <p className="text-[12px] text-secondary mt-0.5 truncate">{e.taetigkeit}</p>}
                        </div>
                        <span className="text-[13px] font-semibold text-primary">{Number(e.stunden).toFixed(2)}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatLongDate(d) {
  return new Date(d).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short' })
}
