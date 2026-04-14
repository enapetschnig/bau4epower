import { useState } from 'react'
import { SpinnerGap, UploadSimple, PencilSimple, Trash, Printer } from '@phosphor-icons/react'
import { useCatalog } from '../hooks/useCatalog.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { GEWERKE_REIHENFOLGE } from '../lib/claude.js'

function Spinner() {
  return <SpinnerGap size={24} weight="bold" className="text-primary animate-spin flex-shrink-0" />
}

function groupByGewerk(items) {
  const map = {}
  for (const item of items) {
    const g = item.gewerk || 'Sonstiges'
    if (!map[g]) map[g] = []
    map[g].push(item)
  }
  // Sort groups by GEWERKE_REIHENFOLGE, unknowns at end
  return Object.entries(map).sort(([a], [b]) => {
    const ai = GEWERKE_REIHENFOLGE.indexOf(a)
    const bi = GEWERKE_REIHENFOLGE.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function KurzTable({ items, gewerkName }) {
  return (
    <table className="print-table-kurz w-full">
      <thead>
        <tr className="print-gewerk-row">
          <td colSpan={4}>{gewerkName}</td>
        </tr>
        <tr>
          <th className="w-20">Nr</th>
          <th>Leistungsname (Kurztext)</th>
          <th className="w-16 text-center">Einheit</th>
          <th className="w-24 text-right">VK Neu Netto / Einheit</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="font-mono text-gray-500">{item.nr}</td>
            <td>{item.name}</td>
            <td className="text-center text-gray-500">{item.einheit}</td>
            <td className="text-right font-medium text-red-700">
              {item.preis > 0 ? Number(item.preis).toFixed(2) : '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DetailTable({ items, gewerkName }) {
  return (
    <table className="print-table-detail w-full">
      <thead>
        <tr className="print-gewerk-row">
          <td colSpan={6}>{gewerkName}</td>
        </tr>
        <tr>
          <th className="w-16">Nr</th>
          <th>Leistungsname (Kurztext) / Beschreibung (Langtext)</th>
          <th className="w-14 text-center">Einheit</th>
          <th className="w-24 text-right">VK Neu Netto / Einheit</th>
          <th className="w-14 text-center">Material</th>
          <th className="w-20 text-center">Lohnkost. min</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="font-mono text-gray-500 align-top">{item.nr}</td>
            <td>
              <span className="font-medium">{item.name}</span>
              {item.beschreibung && (
                <span className="print-detail-desc">{item.beschreibung}</span>
              )}
            </td>
            <td className="text-center text-gray-500">{item.einheit}</td>
            <td className="text-right font-medium text-red-700">
              {item.preis > 0 ? Number(item.preis).toFixed(2) : '–'}
            </td>
            <td className="text-center">
              {item.material_enthalten ? '✓' : '–'}
            </td>
            <td className="text-center text-gray-500">
              {item.zeit_min > 0 ? item.zeit_min : '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Katalog({ embedded = false }) {
  const { catalog, stundensaetze, versions, activeVersion, loading, uploadExcel, activateVersion, renameVersion, deleteVersion } = useCatalog()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [selectedGewerk, setSelectedGewerk] = useState('all')
  const [view, setView] = useState('kurz') // 'kurz' | 'detail'
  const [uploading, setUploading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [activating, setActivating] = useState(null)

  const gewerke = ['all', ...new Set((catalog || []).map(p => p.gewerk).filter(Boolean))]

  const filtered = (catalog || []).filter(item => {
    if (String(item.nr || '').endsWith('-000')) return false
    const matchGewerk = selectedGewerk === 'all' || item.gewerk === selectedGewerk
    const matchSearch = !search ||
      String(item.nr || '').toLowerCase().includes(search.toLowerCase()) ||
      String(item.name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(item.beschreibung || '').toLowerCase().includes(search.toLowerCase())
    return matchGewerk && matchSearch
  })

  const grouped = groupByGewerk(filtered)
  const printDate = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  async function handleExcelUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      const autoName = `Preisliste_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
      const result = await uploadExcel(file, autoName)
      showToast(`✓ ${result.count} Positionen importiert · ${Object.keys(result.stundensaetze).length} Stundensätze erkannt`)
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleActivate(id) {
    setActivating(id)
    try {
      await activateVersion(id)
      showToast('Version aktiviert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActivating(null)
    }
  }

  async function handleRename(id) {
    if (!editName.trim()) return
    await renameVersion(id, editName.trim())
    setEditingId(null)
    showToast('Umbenennung gespeichert')
  }

  async function handleDelete(id) {
    if (!confirm('Version wirklich löschen?')) return
    try {
      await deleteVersion(id)
      showToast('Version gelöscht')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-48">
      <Spinner />
    </div>
  )

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-4 space-y-4'}>

      {/* ── Active Version Banner ── */}
      <div className="card bg-secondary text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Aktive Preisliste</span>
            <h2 className="font-bold text-base mt-0.5 truncate">
              {activeVersion?.name || 'Keine Preisliste geladen'}
            </h2>
            {activeVersion && (
              <p className="text-xs text-gray-400 mt-1">
                {catalog.length} Positionen ·{' '}
                {new Date(activeVersion.uploaded_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            )}
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {versions.length} {versions.length === 1 ? 'Version' : 'Versionen'}
          </span>
        </div>

        {Object.keys(stundensaetze).length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs text-gray-400 mb-2">Erkannte Stundensätze</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stundensaetze).map(([gewerk, satz]) => (
                <span key={gewerk} className="text-xs bg-white/10 px-2 py-1 rounded-lg">
                  {gewerk}: <strong>{satz} €</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Upload (Admin) ── */}
      {isAdmin && (
        <label className={`btn-primary w-full cursor-pointer justify-center text-base py-4 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          {uploading ? (
            <><Spinner /> Wird importiert...</>
          ) : (
            <>
              <UploadSimple size={24} weight="regular" />
              Excel hochladen (.xlsx)
            </>
          )}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={uploading} />
        </label>
      )}

      {/* ── Version List ── */}
      <div className="card space-y-3">
          <h3 className="font-semibold text-secondary">Hochgeladene Preislisten</h3>
          {versions.map(v => (
            <div key={v.id} className={`rounded-xl p-3 border ${v.is_active ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
              {editingId === v.id ? (
                <div className="flex gap-2">
                  <input className="input-field py-2 text-sm flex-1" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename(v.id)} autoFocus />
                  <button onClick={() => handleRename(v.id)} className="btn-primary py-2 text-sm">OK</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary py-2 text-sm">✕</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-secondary truncate">{v.name}</p>
                      {v.is_active && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">aktiv</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(v.uploaded_at).toLocaleDateString('de-AT')}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!v.is_active && isAdmin && (
                      <button onClick={() => handleActivate(v.id)} disabled={activating === v.id} className="text-xs btn-primary py-1.5 px-3">
                        {activating === v.id ? <Spinner /> : 'Aktivieren'}
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => { setEditingId(v.id); setEditName(v.name) }} className="p-2 text-gray-300 active:text-secondary" title="Umbenennen">
                          <PencilSimple size={16} weight="regular" />
                        </button>
                        {!v.is_active && (
                          <button onClick={() => handleDelete(v.id)} className="p-2 text-gray-300 active:text-red-500" title="Löschen">
                            <Trash size={16} weight="regular" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {versions.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine Preisliste hochgeladen</p>}
        </div>

      {/* ── Admin: Upload Hinweis ── */}
      {isAdmin && (
        <p className="text-xs text-gray-400 text-center">Sheet "Leistungen" · Leistungsnummer | Leistungsname (Kurztext) | Gewerk | Einheit | VK Neu Netto / Einheit | Lohnkosten Minuten / Einheit | Materialkosten | Beschreibung (Langtext)</p>
      )}

      {/* ── Catalog Content ── */}
      {catalog.length > 0 && (
        <>
          {/* Toolbar: View toggle + Search + Print */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
              <button
                onClick={() => setView('kurz')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${view === 'kurz' ? 'bg-secondary text-white' : 'text-gray-500 active:bg-gray-50'}`}
              >
                Kurztext
              </button>
              <button
                onClick={() => setView('detail')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${view === 'detail' ? 'bg-secondary text-white' : 'text-gray-500 active:bg-gray-50'}`}
              >
                Langtext
              </button>
            </div>

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="btn-secondary py-2.5 px-4 text-sm flex-shrink-0 ml-auto"
            >
              <Printer size={16} weight="regular" />
              Drucken
            </button>
          </div>

          {/* Search */}
          <input
            className="input-field"
            placeholder="Suche nach Nr, Name oder Beschreibung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Gewerk Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gewerke.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGewerk(g)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${selectedGewerk === g ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
              >
                {g === 'all' ? `Alle (${catalog.length})` : g}
              </button>
            ))}
          </div>

          {/* ── PRINT AREA (also used for screen display) ── */}
          <div id="katalog-print-area">

            {/* Print-only page header (repeats on every page via position:fixed) */}
            <div className="print-page-header hidden">
              <div>
                <span style={{ color: '#c0392b', fontWeight: 800, fontSize: '13px', letterSpacing: '0.05em' }}>BAU4YOU</span>
                <span style={{ color: '#2c3e50', fontWeight: 700, fontSize: '13px' }}> Preisliste</span>
                {activeVersion?.name && (
                  <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: '6px' }}>— {activeVersion.name}</span>
                )}
              </div>
              <span style={{ color: '#6b7280', fontSize: '10px' }}>{printDate}</span>
            </div>

            <div className="print-content space-y-3">
              {/* Screen: grouped cards / Print: tables grouped by Gewerk */}
              {grouped.length === 0 && (
                <div className="card text-center py-8 text-gray-400 text-sm">Keine Positionen gefunden</div>
              )}

              {grouped.map(([gewerkName, items]) => (
                <div key={gewerkName} className="print-gewerk-block">

                  {/* Gewerk heading */}
                  <div className="print-gewerk-heading rounded-t-xl mb-0 px-3 py-1 font-bold text-sm"
                    style={{ background: '#fef2f2', color: '#c0392b', borderBottom: '2px solid #c0392b' }}>
                    {gewerkName}
                    <span className="ml-2 font-normal text-xs" style={{ color: '#c0392b', opacity: 0.7 }}>({items.length} Pos.)</span>
                  </div>

                  {/* KURZ VIEW */}
                  {view === 'kurz' && (
                    <div className="bg-white rounded-b-xl overflow-hidden border border-gray-100 border-t-0">
                      {/* Screen table */}
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                          <tr>
                            <th className="text-left px-2 py-0.5 w-20 font-medium">Nr</th>
                            <th className="text-left px-2 py-0.5 font-medium">Leistungsname (Kurztext)</th>
                            <th className="text-center px-2 py-0.5 w-16 font-medium">Einheit</th>
                            <th className="text-right px-2 py-0.5 w-24 font-medium">VK Neu Netto / Einheit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-2 py-px font-mono text-gray-400 text-[11px]">{item.nr}</td>
                              <td className="px-2 py-px text-secondary text-[12px]">{item.name}</td>
                              <td className="px-2 py-px text-center text-gray-500 text-[12px]">{item.einheit}</td>
                              <td className="px-2 py-px text-right font-semibold text-primary text-[12px]">
                                {item.preis > 0 ? Number(item.preis).toFixed(2) : '–'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Print table (hidden on screen, shown in print via CSS) */}
                      <div className="hidden-screen">
                        <KurzTable items={items} gewerkName={gewerkName} />
                      </div>
                    </div>
                  )}

                  {/* DETAIL VIEW */}
                  {view === 'detail' && (
                    <div className="bg-white rounded-b-xl overflow-hidden border border-gray-100 border-t-0">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                          <tr>
                            <th className="text-left px-2 py-0.5 w-16 font-medium">Nr</th>
                            <th className="text-left px-2 py-0.5 font-medium">Leistungsname (Kurztext) / Beschreibung (Langtext)</th>
                            <th className="text-center px-2 py-0.5 w-14 font-medium">Einheit</th>
                            <th className="text-right px-2 py-0.5 w-24 font-medium">VK Neu Netto / Einheit</th>
                            <th className="text-center px-2 py-0.5 w-12 font-medium">Mat.</th>
                            <th className="text-center px-2 py-0.5 w-16 font-medium">Lohnkost. min</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-2 py-px font-mono text-gray-400 text-[11px] align-top">{item.nr}</td>
                              <td className="px-2 py-px align-top">
                                <span className="text-secondary font-medium text-[12px]">{item.name}</span>
                                {item.beschreibung && (
                                  <span className="block text-gray-400 text-[10px] leading-snug">{item.beschreibung}</span>
                                )}
                              </td>
                              <td className="px-2 py-px text-center text-gray-500 text-[12px] align-top">{item.einheit}</td>
                              <td className="px-2 py-px text-right font-semibold text-primary text-[12px] align-top">
                                {item.preis > 0 ? Number(item.preis).toFixed(2) : '–'}
                              </td>
                              <td className="px-2 py-px text-center text-gray-400 text-[12px] align-top">
                                {item.material_enthalten ? <span className="text-green-600">✓</span> : '–'}
                              </td>
                              <td className="px-2 py-px text-center text-gray-400 text-[12px] align-top">
                                {item.zeit_min > 0 ? item.zeit_min : '–'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Print table */}
                      <div className="hidden-screen">
                        <DetailTable items={items} gewerkName={gewerkName} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {catalog.length === 0 && !loading && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">Noch keine Preisliste geladen</p>
          <p className="text-sm mt-1">Excel-Datei oben hochladen</p>
        </div>
      )}
    </div>
  )
}
