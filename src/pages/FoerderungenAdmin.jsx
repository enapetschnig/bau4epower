import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Trash, PencilSimple, X, SpinnerGap, ToggleLeft, ToggleRight, CurrencyEur, Info } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import {
  loadAllFoerderungen, createFoerderung, updateFoerderung, deleteFoerderung,
  FOERDERUNG_KATEGORIEN, ABRECHNUNGSARTEN_F,
} from '../lib/foerderungen.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

export default function FoerderungenAdmin() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)

  if (!isAdmin) return <Navigate to="/" replace />

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      setItems(await loadAllFoerderungen())
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Förderung wirklich löschen?')) return
    try {
      await deleteFoerderung(id)
      setItems(prev => prev.filter(z => z.id !== id))
      showToast('Gelöscht')
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    }
  }

  async function handleToggleActive(z) {
    try {
      await updateFoerderung(z.id, { is_active: !z.is_active })
      setItems(prev => prev.map(x => x.id === z.id ? { ...x, is_active: !z.is_active } : x))
    } catch {
      showToast('Aktualisierung fehlgeschlagen', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-6">
      <PageHeader
        title="PV-Förderungen"
        subtitle="Bundes-, Landes- und Sonderförderungen"
        backTo="/admin"
        action={
          <button onClick={() => setShowNew(true)} className="btn-primary px-3">
            <Plus size={14} weight="bold" />
            Neu
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-blue-900 leading-relaxed">
            Hier konfigurierst du Förderungen, die im PV-Angebot zur Kundenpräsentation
            vorgeschlagen werden. Die Werte können später pro Angebot angepasst werden.
            <br/>
            <strong>Achtung:</strong> Die Standard-Beträge sind Schätzwerte – aktuelle Förderbeträge bitte prüfen.
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <SpinnerGap size={28} className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <CurrencyEur size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[13px] text-gray-400">Noch keine Förderungen angelegt</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mt-3 inline-flex">
              <Plus size={14} weight="bold" />
              Erste Förderung anlegen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(f => {
              const kat = FOERDERUNG_KATEGORIEN.find(k => k.v === f.kategorie)
              const art = ABRECHNUNGSARTEN_F.find(a => a.v === f.abrechnungsart)
              return (
                <div key={f.id} className={`bg-white rounded-lg border p-3 transition-opacity
                  ${f.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-[13px] font-semibold text-secondary">{f.name}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-px rounded">{kat?.l}</span>
                        {!f.is_active && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-px rounded">inaktiv</span>
                        )}
                      </div>
                      {f.beschreibung && (
                        <p className="text-[11px] text-gray-500 mb-1">{f.beschreibung}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-bold text-emerald-600">
                          {Number(f.betrag).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
                          {f.abrechnungsart === 'prozent' && '%'}
                        </span>
                        <span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[10px] text-gray-500">{art?.l}</span>
                        {f.max_betrag && (
                          <>
                            <span className="text-[10px] text-gray-400">·</span>
                            <span className="text-[10px] text-gray-500">max. {Number(f.max_betrag).toLocaleString('de-AT')} €</span>
                          </>
                        )}
                      </div>
                      {f.hinweis && (
                        <p className="text-[10px] text-amber-600 mt-1 italic">{f.hinweis}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(f)}
                        className="touch-btn text-gray-400"
                        title={f.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {f.is_active
                          ? <ToggleRight size={20} weight="fill" className="text-emerald-500" />
                          : <ToggleLeft size={20} weight="regular" />}
                      </button>
                      <button onClick={() => setEditing(f)} className="touch-btn text-gray-400">
                        <PencilSimple size={14} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="touch-btn text-gray-300 hover:text-red-500">
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(showNew || editing) && (
        <FoerderungDialog
          foerderung={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}

function FoerderungDialog({ foerderung, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: foerderung?.name || '',
    beschreibung: foerderung?.beschreibung || '',
    kategorie: foerderung?.kategorie || 'modul',
    abrechnungsart: foerderung?.abrechnungsart || 'pro_kwp',
    betrag: foerderung?.betrag || '',
    max_betrag: foerderung?.max_betrag || '',
    min_anlage_kwp: foerderung?.min_anlage_kwp || '',
    max_anlage_kwp: foerderung?.max_anlage_kwp || '',
    hinweis: foerderung?.hinweis || '',
    begruendung: foerderung?.begruendung || '',
    call_zeitraum: foerderung?.call_zeitraum || '',
    antragstelle: foerderung?.antragstelle || '',
    link: foerderung?.link || '',
    voraussetzungen: foerderung?.voraussetzungen || '',
    antragsablauf: foerderung?.antragsablauf || '',
    deadline_aktuell: foerderung?.deadline_aktuell || '',
    naechster_call_datum: foerderung?.naechster_call_datum || '',
    budget_status: foerderung?.budget_status || '',
    bearbeitungsdauer: foerderung?.bearbeitungsdauer || '',
    auszahlungsmodus: foerderung?.auszahlungsmodus || '',
    excludes: foerderung?.excludes || [],
    is_active: foerderung?.is_active ?? true,
  })
  const [allFoerderungen, setAllFoerderungen] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Andere Förderungen laden für die Ausschluss-Auswahl
    loadAllFoerderungen()
      .then(list => setAllFoerderungen(list.filter(f => f.id !== foerderung?.id)))
      .catch(() => setAllFoerderungen([]))
  }, [foerderung?.id])

  function toggleExclude(id) {
    setForm(prev => ({
      ...prev,
      excludes: prev.excludes.includes(id)
        ? prev.excludes.filter(x => x !== id)
        : [...prev.excludes, id],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        betrag: parseFloat(form.betrag) || 0,
        max_betrag: form.max_betrag ? parseFloat(form.max_betrag) : null,
        min_anlage_kwp: form.min_anlage_kwp ? parseFloat(form.min_anlage_kwp) : null,
        max_anlage_kwp: form.max_anlage_kwp ? parseFloat(form.max_anlage_kwp) : null,
        naechster_call_datum: form.naechster_call_datum || null,
        excludes: form.excludes || [],
      }
      if (foerderung) {
        await updateFoerderung(foerderung.id, payload)
      } else {
        await createFoerderung(payload)
      }
      showToast('Gespeichert')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">
            {foerderung ? 'Förderung bearbeiten' : 'Neue Förderung'}
          </h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="label block mb-0.5">Name *</label>
            <input required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="z.B. Bundesförderung PV-Module" />
          </div>
          <div>
            <label className="label block mb-0.5">Beschreibung</label>
            <input value={form.beschreibung}
              onChange={e => setForm({ ...form, beschreibung: e.target.value })}
              className="input-field"
              placeholder="Kurze Erklärung..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Kategorie *</label>
              <select value={form.kategorie}
                onChange={e => setForm({ ...form, kategorie: e.target.value })}
                className="input-field">
                {FOERDERUNG_KATEGORIEN.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-0.5">Abrechnungsart *</label>
              <select value={form.abrechnungsart}
                onChange={e => setForm({ ...form, abrechnungsart: e.target.value })}
                className="input-field">
                {ABRECHNUNGSARTEN_F.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Betrag *</label>
              <input required type="number" step="0.01" value={form.betrag}
                onChange={e => setForm({ ...form, betrag: e.target.value })}
                className="input-field" />
            </div>
            <div>
              <label className="label block mb-0.5">Max-Betrag</label>
              <input type="number" step="0.01" value={form.max_betrag}
                onChange={e => setForm({ ...form, max_betrag: e.target.value })}
                className="input-field"
                placeholder="optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Min Anlage kWp</label>
              <input type="number" step="0.01" value={form.min_anlage_kwp}
                onChange={e => setForm({ ...form, min_anlage_kwp: e.target.value })}
                className="input-field"
                placeholder="optional" />
            </div>
            <div>
              <label className="label block mb-0.5">Max Anlage kWp</label>
              <input type="number" step="0.01" value={form.max_anlage_kwp}
                onChange={e => setForm({ ...form, max_anlage_kwp: e.target.value })}
                className="input-field"
                placeholder="optional" />
            </div>
          </div>
          <div>
            <label className="label block mb-0.5">Hinweis (interner Tipp)</label>
            <input value={form.hinweis}
              onChange={e => setForm({ ...form, hinweis: e.target.value })}
              className="input-field"
              placeholder="z.B. Antrag VOR Auftragserteilung stellen" />
          </div>

          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="text-[11px] text-gray-500 mb-2 font-semibold">Texte für Kunden-Präsentation</p>

            <div>
              <label className="label block mb-0.5">Wie kommt der Betrag zustande?</label>
              <textarea value={form.begruendung}
                onChange={e => setForm({ ...form, begruendung: e.target.value })}
                className="input-field min-h-[60px]"
                placeholder="Z.B. Förderbetrag wird je kWp Modulleistung berechnet..." />
            </div>

            <div className="mt-2">
              <label className="label block mb-0.5">Wann sind die Calls?</label>
              <textarea value={form.call_zeitraum}
                onChange={e => setForm({ ...form, call_zeitraum: e.target.value })}
                className="input-field min-h-[50px]"
                placeholder="Z.B. Calls finden 4× pro Jahr statt (März, Juni, Sept, Nov)" />
            </div>

            <div className="mt-2">
              <label className="label block mb-0.5">Antragstelle</label>
              <input value={form.antragstelle}
                onChange={e => setForm({ ...form, antragstelle: e.target.value })}
                className="input-field"
                placeholder="Z.B. Klima- und Energiefonds (KPC)" />
            </div>

            <div className="mt-2">
              <label className="label block mb-0.5">Link (optional)</label>
              <input value={form.link}
                onChange={e => setForm({ ...form, link: e.target.value })}
                className="input-field"
                placeholder="https://..." />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="text-[11px] text-gray-500 mb-2 font-semibold">Aktuelle Termine & Status</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label block mb-0.5">Nächster Call</label>
                <input type="date" value={form.naechster_call_datum}
                  onChange={e => setForm({ ...form, naechster_call_datum: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label block mb-0.5">Budget-Status</label>
                <select value={form.budget_status}
                  onChange={e => setForm({ ...form, budget_status: e.target.value })}
                  className="input-field">
                  <option value="">– unbekannt –</option>
                  <option value="ausreichend">Ausreichend</option>
                  <option value="knapp">Knapp</option>
                  <option value="ausgeschoepft">Ausgeschöpft</option>
                </select>
              </div>
            </div>

            <div className="mt-2">
              <label className="label block mb-0.5">Aktuelle Deadline (Freitext)</label>
              <input value={form.deadline_aktuell}
                onChange={e => setForm({ ...form, deadline_aktuell: e.target.value })}
                className="input-field"
                placeholder="z.B. 'Call läuft bis 31.05.2026, 12:00 Uhr'" />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="label block mb-0.5">Bearbeitungsdauer</label>
                <input value={form.bearbeitungsdauer}
                  onChange={e => setForm({ ...form, bearbeitungsdauer: e.target.value })}
                  className="input-field"
                  placeholder="z.B. 8-12 Wochen" />
              </div>
              <div>
                <label className="label block mb-0.5">Auszahlungsmodus</label>
                <input value={form.auszahlungsmodus}
                  onChange={e => setForm({ ...form, auszahlungsmodus: e.target.value })}
                  className="input-field"
                  placeholder="z.B. Nach Inbetriebnahme" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="text-[11px] text-gray-500 mb-2 font-semibold">Voraussetzungen & Antragsablauf</p>

            <div>
              <label className="label block mb-0.5">Voraussetzungen (Wer ist berechtigt?)</label>
              <textarea value={form.voraussetzungen}
                onChange={e => setForm({ ...form, voraussetzungen: e.target.value })}
                className="input-field min-h-[60px]"
                placeholder="z.B. Hauptwohnsitz in Steiermark, Antrag VOR Auftragserteilung, etc." />
            </div>

            <div className="mt-2">
              <label className="label block mb-0.5">Antragsablauf (Wie geht's Schritt für Schritt?)</label>
              <textarea value={form.antragsablauf}
                onChange={e => setForm({ ...form, antragsablauf: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="1. Online-Registrierung\n2. Antrag mit Daten der geplanten Anlage\n3. Förderzusage abwarten\n4. ..." />
            </div>
          </div>

          {allFoerderungen.length > 0 && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <p className="text-[11px] text-gray-500 mb-2 font-semibold">
                Schließt diese Förderungen aus
                <span className="text-gray-400 font-normal">  (kombinierbar wenn nichts gewählt)</span>
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {allFoerderungen.map(other => (
                  <label key={other.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px]
                      ${form.excludes.includes(other.id) ? 'bg-rose-50 text-rose-700' : 'bg-gray-50 text-gray-600'}`}>
                    <input type="checkbox"
                      checked={form.excludes.includes(other.id)}
                      onChange={() => toggleExclude(other.id)}
                      className="w-3.5 h-3.5 accent-rose-500" />
                    <span className="truncate">{other.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-gray-100">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-primary" />
            <span className="text-[12px] text-secondary">Aktiv (steht in PV-Angeboten zur Auswahl)</span>
          </label>

          <button type="submit" disabled={saving} className="btn-primary w-full mt-3">
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
