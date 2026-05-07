import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash, PencilSimple, X, SpinnerGap, ArrowLeft, Wrench, MagnifyingGlass } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadAllPvProducts, createPvProduct, updatePvProduct, deletePvProduct } from '../lib/pvProducts.js'

const CATEGORIES = [
  { v: 'modul', l: 'PV Module' },
  { v: 'wechselrichter', l: 'Wechselrichter' },
  { v: 'speicher', l: 'Speicher' },
  { v: 'smart-meter', l: 'Smart Meter' },
  { v: 'backup', l: 'Backup/Notstrom' },
  { v: 'wallbox', l: 'Wallbox' },
  { v: 'heizstab', l: 'Heizstab' },
  { v: 'montage', l: 'Montage' },
  { v: 'installation', l: 'DC/AC Installation' },
  { v: 'abwicklung', l: 'Abwicklung' },
  { v: 'zubehoer', l: 'Zubehör' },
]

export default function PvMaterial() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [editing, setEditing] = useState(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/angebote')
      return
    }
    refresh()
  }, [isAdmin])

  async function refresh() {
    setLoading(true)
    try {
      const data = await loadAllPvProducts()
      setProducts(data)
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Produkt wirklich löschen?')) return
    try {
      await deletePvProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
      showToast('Gelöscht')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    }
  }

  const filtered = products.filter(p => {
    if (filterCat !== 'all' && p.category !== filterCat) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (p.name || '').toLowerCase().includes(s) ||
      (p.modell || '').toLowerCase().includes(s) ||
      (p.hersteller || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => navigate('/angebote')} className="touch-btn text-gray-400">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-secondary flex-1">Material-Katalog</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary px-3">
          <Plus size={14} weight="bold" />
          Neu
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-px bg-gray-100 rounded-md p-0.5 w-max">
            <button
              onClick={() => setFilterCat('all')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-[5px] transition-all whitespace-nowrap
                ${filterCat === 'all' ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
            >
              Alle
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.v}
                onClick={() => setFilterCat(c.v)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-[5px] transition-all whitespace-nowrap
                  ${filterCat === c.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}
              >
                {c.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <SpinnerGap size={28} weight="bold" className="text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-400">
          <Wrench size={32} className="mx-auto mb-2 text-gray-200" />
          Keine Produkte
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-px rounded">
                      {CATEGORIES.find(c => c.v === p.category)?.l || p.category}
                    </span>
                    {p.hersteller && (
                      <span className="text-[10px] text-gray-400">{p.hersteller}</span>
                    )}
                  </div>
                  <p className="text-[12px] font-semibold text-secondary truncate">{p.name}</p>
                  {p.modell && <p className="text-[10px] text-gray-400 truncate">{p.modell}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-primary whitespace-nowrap">
                    {Number(p.preis).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
                  </span>
                  <button onClick={() => setEditing(p)} className="touch-btn text-gray-400">
                    <PencilSimple size={13} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="touch-btn text-gray-300 hover:text-red-500">
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNew || editing) && (
        <ProductDialog
          product={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}

function ProductDialog({ product, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    category: product?.category || 'modul',
    hersteller: product?.hersteller || '',
    name: product?.name || '',
    modell: product?.modell || '',
    einheit: product?.einheit || 'Stk',
    preis: product?.preis || '',
    leistung_w: product?.leistung_w || '',
    kapazitaet_kwh: product?.kapazitaet_kwh || '',
    beschreibung: product?.beschreibung || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.category) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        preis: parseFloat(form.preis) || 0,
        leistung_w: form.leistung_w ? parseFloat(form.leistung_w) : null,
        kapazitaet_kwh: form.kapazitaet_kwh ? parseFloat(form.kapazitaet_kwh) : null,
      }
      if (product) {
        await updatePvProduct(product.id, payload)
      } else {
        await createPvProduct(payload)
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
            {product ? 'Produkt bearbeiten' : 'Neues Produkt'}
          </h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="label block mb-0.5">Kategorie *</label>
            <select required value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
              {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <input placeholder="Hersteller" value={form.hersteller}
            onChange={e => setForm({ ...form, hersteller: e.target.value })} className="input-field" />
          <input required placeholder="Produktname *" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" />
          <input placeholder="Modell-Nr." value={form.modell}
            onChange={e => setForm({ ...form, modell: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-2">
            <input required type="number" step="0.01" placeholder="Preis € *" value={form.preis}
              onChange={e => setForm({ ...form, preis: e.target.value })} className="input-field" />
            <select value={form.einheit}
              onChange={e => setForm({ ...form, einheit: e.target.value })} className="input-field">
              <option>Stk</option>
              <option>EH</option>
              <option>ST</option>
              <option>m</option>
              <option>m²</option>
              <option>Std</option>
              <option>kWh</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Leistung W" value={form.leistung_w}
              onChange={e => setForm({ ...form, leistung_w: e.target.value })} className="input-field" />
            <input type="number" step="0.01" placeholder="Kapazität kWh" value={form.kapazitaet_kwh}
              onChange={e => setForm({ ...form, kapazitaet_kwh: e.target.value })} className="input-field" />
          </div>
          <textarea placeholder="Beschreibung" value={form.beschreibung}
            onChange={e => setForm({ ...form, beschreibung: e.target.value })} className="input-field min-h-[60px]" />

          <button type="submit" disabled={saving} className="btn-primary w-full mt-3">
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
