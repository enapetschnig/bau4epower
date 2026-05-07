import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash, X, SpinnerGap, FilePdf, FloppyDisk, ArrowLeft, SunHorizon, Lightning, BatteryFull, House, Plug, Thermometer, Camera, ShieldCheck, Eye, CurrencyEur, Presentation } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadPvProducts, calcMontagePreis, calcInstallationPreis } from '../lib/pvProducts.js'
import { createPvOffer, updatePvOffer, loadPvOffer, calculateTotals } from '../lib/pvOffers.js'
import { generatePvAngebotPdf } from '../lib/pvPdfGenerator.js'
import { loadFoerderungen, calcFoerderung } from '../lib/foerderungen.js'
import PvAngebotVorschau from '../components/PvAngebotVorschau.jsx'
import KundenPraesentation from '../components/KundenPraesentation.jsx'

const DACHTYPEN = [
  { v: 'ziegel', l: 'Ziegeldach' },
  { v: 'blech', l: 'Trapezblech' },
  { v: 'flachdach', l: 'Flachdach' },
  { v: 'bitumen', l: 'Bitumen/Pappdach' },
]

export default function PvAngebotNeu() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [products, setProducts] = useState([])
  const [foerderungen, setFoerderungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)

  // Förderungen: Map von foerderung_id → { aktiv, betrag (custom override) }
  const [selectedFoerderungen, setSelectedFoerderungen] = useState({})

  // Form state
  const [kunde, setKunde] = useState({
    anrede: 'Herr', vorname: '', nachname: '', firma: '',
    strasse: '', plz: '', ort: '', email: '', telefon: '', uid_nummer: '',
    kd_nr: '',
  })

  // PV Anlage
  const [modulId, setModulId] = useState('')
  const [modulAnzahl, setModulAnzahl] = useState(20)
  const [wechselrichterId, setWechselrichterId] = useState('')
  const [smartMeterId, setSmartMeterId] = useState('')
  const [dachtyp, setDachtyp] = useState('ziegel')

  // Speicher
  const [speicherEnabled, setSpeicherEnabled] = useState(true)
  const [speicherId, setSpeicherId] = useState('')
  const [speicherAnzahl, setSpeicherAnzahl] = useState(2)
  const [speicherPowerId, setSpeicherPowerId] = useState('')
  const [backupId, setBackupId] = useState('')

  // Optional
  const [wallboxId, setWallboxId] = useState('')
  const [heizstabId, setHeizstabId] = useState('')

  const [notes, setNotes] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    loadInitial()
  }, [id])

  async function loadInitial() {
    setLoading(true)
    try {
      const [prods, foerd] = await Promise.all([
        loadPvProducts(),
        loadFoerderungen().catch(() => []),
      ])
      setProducts(prods)
      setFoerderungen(foerd)

      // Defaults
      const defModul = prods.find(p => p.category === 'modul' && p.modell?.includes('AS-6M-380W'))
      if (defModul) setModulId(defModul.id)
      const defWR = prods.find(p => p.category === 'wechselrichter' && p.modell?.includes('SUN2000-8KTL'))
      if (defWR) setWechselrichterId(defWR.id)
      const defSM = prods.find(p => p.category === 'smart-meter' && p.hersteller === 'Huawei')
      if (defSM) setSmartMeterId(defSM.id)
      const defSp = prods.find(p => p.category === 'speicher' && p.modell === 'LUNA2000-5-E0')
      if (defSp) setSpeicherId(defSp.id)
      const defSpP = prods.find(p => p.category === 'speicher' && p.modell?.includes('LUNA2000-5KW'))
      if (defSpP) setSpeicherPowerId(defSpP.id)
      const defBackup = prods.find(p => p.category === 'backup' && p.modell?.includes('B1'))
      if (defBackup) setBackupId(defBackup.id)

      if (isEdit) {
        const offer = await loadPvOffer(id)
        if (offer) {
          setKunde({
            anrede: offer.anrede || 'Herr',
            vorname: offer.vorname || '', nachname: offer.nachname || '',
            firma: offer.firma || '',
            strasse: offer.strasse || '', plz: offer.plz || '', ort: offer.ort || '',
            email: offer.email || '', telefon: offer.telefon || '',
            uid_nummer: offer.uid_nummer || '',
            kd_nr: offer.kd_nr || '',
          })
          setNotes(offer.notes || '')
          setDatum(offer.datum?.slice(0, 10) || new Date().toISOString().slice(0, 10))
          // Reverse-engineer form fields from positionen if possible
        }
      }
    } catch (err) {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Berechnete Werte
  const modul = products.find(p => p.id === modulId)
  const wr = products.find(p => p.id === wechselrichterId)
  const smartMeter = products.find(p => p.id === smartMeterId)
  const speicher = products.find(p => p.id === speicherId)
  const speicherPower = products.find(p => p.id === speicherPowerId)
  const backup = products.find(p => p.id === backupId)
  const wallbox = products.find(p => p.id === wallboxId)
  const heizstab = products.find(p => p.id === heizstabId)

  const kwp = modul ? Math.round(modul.leistung_w * modulAnzahl) / 1000 : 0
  const speicherKwh = speicher ? speicher.kapazitaet_kwh * speicherAnzahl : 0

  // ── Generiere Gruppen-Struktur fürs PDF + DB
  function buildGruppen() {
    const gruppen = []

    // Gruppe 01: PV Anlage
    if (modul && wr) {
      const pvPositionen = []
      pvPositionen.push({
        name: modul.name,
        modell: modul.modell,
        menge: modulAnzahl,
        einheit: 'Stk',
        preis: Number(modul.preis),
        product_id: modul.id,
      })
      pvPositionen.push({
        name: wr.name,
        modell: wr.modell,
        menge: 1,
        einheit: 'Stk',
        preis: Number(wr.preis),
        product_id: wr.id,
      })
      if (smartMeter) {
        pvPositionen.push({
          name: smartMeter.name,
          modell: smartMeter.modell,
          menge: 1,
          einheit: 'Stk',
          preis: Number(smartMeter.preis),
          product_id: smartMeter.id,
        })
      }
      // Montagematerial
      const montagePreis = calcMontagePreis(modulAnzahl, dachtyp)
      const dachLabel = DACHTYPEN.find(d => d.v === dachtyp)?.l || 'Ziegeldach'
      pvPositionen.push({
        name: `Montagematerial ${dachLabel}`,
        menge: 1,
        einheit: 'EH',
        preis: montagePreis,
      })
      // DC/AC Material
      pvPositionen.push({
        name: 'DC/AC Installationsmaterial',
        menge: 1,
        einheit: 'EH',
        preis: calcInstallationPreis(kwp),
      })
      // Abwicklung
      pvPositionen.push({
        name: 'Abwicklung Netzbetreiber',
        menge: 1,
        einheit: 'Stk',
        preis: 250,
      })
      pvPositionen.push({
        name: 'Mithilfe Förderabwicklung',
        menge: 1,
        einheit: 'Stk',
        preis: 200,
      })
      gruppen.push({
        name: `PV Anlage ${kwp.toString().replace('.', ',')}kWp`,
        positionen: pvPositionen,
      })
    }

    // Gruppe 02: Energiespeicher
    if (speicherEnabled && speicher) {
      const speicherPositionen = []
      if (speicherPower) {
        speicherPositionen.push({
          name: speicherPower.name,
          modell: speicherPower.modell,
          menge: 1,
          einheit: 'ST',
          preis: Number(speicherPower.preis),
          product_id: speicherPower.id,
        })
      }
      speicherPositionen.push({
        name: speicher.name,
        modell: speicher.modell,
        menge: speicherAnzahl,
        einheit: 'ST',
        preis: Number(speicher.preis),
        product_id: speicher.id,
      })
      if (backup) {
        speicherPositionen.push({
          name: backup.name,
          modell: backup.modell,
          menge: 1,
          einheit: 'ST',
          preis: Number(backup.preis),
          product_id: backup.id,
        })
      }
      speicherPositionen.push({
        name: 'Verkabelungsmaterial',
        menge: 1,
        einheit: 'EH',
        preis: 180,
      })

      gruppen.push({
        name: `Energiespeicher ${speicherKwh}kWh`,
        positionen: speicherPositionen,
      })
    }

    // Gruppe 03: Wallbox (optional)
    if (wallbox) {
      gruppen.push({
        name: 'Wallbox',
        positionen: [
          { name: wallbox.name, modell: wallbox.modell, menge: 1, einheit: 'Stk', preis: Number(wallbox.preis), product_id: wallbox.id },
          { name: 'Anschlussmaterial Wallbox', menge: 1, einheit: 'EH', preis: 250 },
          { name: 'Installation Wallbox', menge: 1, einheit: 'Std', preis: 280 },
        ],
      })
    }

    // Gruppe 04: Heizstab
    if (heizstab) {
      gruppen.push({
        name: 'PV-Heizstab',
        positionen: [
          { name: heizstab.name, modell: heizstab.modell, menge: 1, einheit: 'Stk', preis: Number(heizstab.preis), product_id: heizstab.id },
          { name: 'Installation Heizstab', menge: 1, einheit: 'Std', preis: 220 },
        ],
      })
    }

    return gruppen
  }

  const gruppen = buildGruppen()
  const totals = calculateTotals(gruppen)

  // Förderungs-Berechnung
  const foerderungsContext = {
    kwp,
    speicher_kwh: speicherEnabled ? speicherKwh : 0,
    hat_wallbox: !!wallbox,
    hat_heizstab: !!heizstab,
    netto: totals.netto,
    brutto: totals.brutto,
  }

  const aktiveFoerderungen = foerderungen
    .map(f => {
      const sel = selectedFoerderungen[f.id]
      if (!sel?.aktiv) return null
      const auto = calcFoerderung(f, foerderungsContext)
      const betrag = sel.custom !== undefined && sel.custom !== '' ? Number(sel.custom) : auto
      return { ...f, _berechnet: betrag, _eligible: auto > 0 || sel.custom !== undefined }
    })
    .filter(Boolean)

  const foerderungSumme = aktiveFoerderungen.reduce((s, f) => s + (Number(f._berechnet) || 0), 0)
  const endpreis = Math.max(0, totals.brutto - foerderungSumme)

  function toggleFoerderung(f) {
    setSelectedFoerderungen(prev => {
      const next = { ...prev }
      if (next[f.id]?.aktiv) {
        next[f.id] = { ...next[f.id], aktiv: false }
      } else {
        next[f.id] = { aktiv: true, custom: undefined }
      }
      return next
    })
  }

  function setFoerderungCustom(id, val) {
    setSelectedFoerderungen(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), aktiv: true, custom: val }
    }))
  }

  async function handleSave(andThenPdf = false) {
    if (!kunde.nachname && !kunde.firma) {
      showToast('Bitte Kunde-Name eingeben', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...kunde,
        datum,
        anlage_kwp: kwp,
        dachtyp,
        notes,
        positionen: gruppen,
        netto: totals.netto,
        mwst: totals.mwst,
        brutto: totals.brutto,
        hat_speicher: speicherEnabled,
        hat_wallbox: !!wallbox,
        hat_heizstab: !!heizstab,
        hat_backup: !!backup,
        foerderung_aktiv: aktiveFoerderungen.length > 0,
        foerderungen_data: aktiveFoerderungen.map(f => ({
          id: f.id,
          name: f.name,
          kategorie: f.kategorie,
          betrag: f._berechnet,
        })),
        foerderung_summe: foerderungSumme,
        endpreis_nach_foerderung: endpreis,
        status: 'entwurf',
      }
      let savedId = id
      if (isEdit) {
        await updatePvOffer(id, payload)
      } else {
        const created = await createPvOffer(payload)
        savedId = created.id
      }
      showToast(isEdit ? 'Gespeichert' : 'Angebot angelegt')

      if (andThenPdf) {
        await generateAndDownload(savedId)
      } else {
        navigate('/angebote')
      }
    } catch (err) {
      showToast(err.message || 'Speichern fehlgeschlagen', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function generateAndDownload(offerId) {
    setGeneratingPdf(true)
    try {
      const fresh = await loadPvOffer(offerId)
      const blob = await generatePvAngebotPdf(fresh)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Angebot_${fresh.beleg_nr}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showToast('PDF erstellt')
    } catch (err) {
      showToast('PDF-Erstellung fehlgeschlagen', 'error')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <SpinnerGap size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  const moduleProds = products.filter(p => p.category === 'modul')
  const wrProds = products.filter(p => p.category === 'wechselrichter')
  const smProds = products.filter(p => p.category === 'smart-meter')
  const spProds = products.filter(p => p.category === 'speicher' && p.kapazitaet_kwh > 0)
  const spPowerProds = products.filter(p => p.category === 'speicher' && !p.kapazitaet_kwh)
  const bpProds = products.filter(p => p.category === 'backup')
  const wbProds = products.filter(p => p.category === 'wallbox')
  const hzProds = products.filter(p => p.category === 'heizstab')

  return (
    <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/angebote')} className="touch-btn text-gray-400">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-secondary">
          {isEdit ? 'Angebot bearbeiten' : 'Neues PV-Angebot'}
        </h1>
      </div>

      {/* Kunde */}
      <Section icon={<House size={14} weight="fill" className="text-primary" />} title="Kunde">
        <div className="grid grid-cols-3 gap-2">
          <select value={kunde.anrede} onChange={e => setKunde({ ...kunde, anrede: e.target.value })} className="input-field">
            <option>Herr</option>
            <option>Frau</option>
            <option>Familie</option>
            <option>Firma</option>
          </select>
          <input placeholder="Vorname" value={kunde.vorname}
            onChange={e => setKunde({ ...kunde, vorname: e.target.value })} className="input-field col-span-2" />
        </div>
        <input placeholder="Nachname *" value={kunde.nachname}
          onChange={e => setKunde({ ...kunde, nachname: e.target.value })} className="input-field" />
        <input placeholder="Firma (optional)" value={kunde.firma}
          onChange={e => setKunde({ ...kunde, firma: e.target.value })} className="input-field" />
        <input placeholder="Straße + Hausnummer" value={kunde.strasse}
          onChange={e => setKunde({ ...kunde, strasse: e.target.value })} className="input-field" />
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="PLZ" value={kunde.plz}
            onChange={e => setKunde({ ...kunde, plz: e.target.value })} className="input-field" />
          <input placeholder="Ort" value={kunde.ort}
            onChange={e => setKunde({ ...kunde, ort: e.target.value })} className="input-field col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="E-Mail" value={kunde.email}
            onChange={e => setKunde({ ...kunde, email: e.target.value })} className="input-field" />
          <input placeholder="Telefon" value={kunde.telefon}
            onChange={e => setKunde({ ...kunde, telefon: e.target.value })} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Kd-Nr." value={kunde.kd_nr}
            onChange={e => setKunde({ ...kunde, kd_nr: e.target.value })} className="input-field" />
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="input-field" />
        </div>
      </Section>

      {/* PV Anlage */}
      <Section icon={<SunHorizon size={14} weight="fill" className="text-amber-500" />} title="PV-Anlage">
        <label className="label block">PV-Modul</label>
        <select value={modulId} onChange={e => setModulId(e.target.value)} className="input-field">
          {moduleProds.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} – {Number(p.preis).toFixed(2)} €
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label block mb-0.5">Anzahl Module</label>
            <input type="number" min="1" value={modulAnzahl}
              onChange={e => setModulAnzahl(parseInt(e.target.value) || 0)}
              className="input-field" />
          </div>
          <div>
            <label className="label block mb-0.5">Anlagengröße</label>
            <div className="input-field bg-gray-50 font-bold text-primary flex items-center">
              {kwp.toLocaleString('de-AT', { minimumFractionDigits: 2 })} kWp
            </div>
          </div>
        </div>

        <label className="label block mt-2">Wechselrichter</label>
        <select value={wechselrichterId} onChange={e => setWechselrichterId(e.target.value)} className="input-field">
          {wrProds.map(p => (
            <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
          ))}
        </select>

        <label className="label block mt-2">Smart Meter</label>
        <select value={smartMeterId} onChange={e => setSmartMeterId(e.target.value)} className="input-field">
          <option value="">– kein Smart Meter –</option>
          {smProds.map(p => (
            <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
          ))}
        </select>

        <label className="label block mt-2">Dachtyp (für Montagematerial)</label>
        <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
          {DACHTYPEN.map(d => (
            <button key={d.v} type="button"
              onClick={() => setDachtyp(d.v)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-[5px] transition-all
                ${dachtyp === d.v ? 'bg-white text-secondary shadow-sm' : 'text-gray-400'}`}>
              {d.l}
            </button>
          ))}
        </div>
      </Section>

      {/* Speicher */}
      <Section
        icon={<BatteryFull size={14} weight="fill" className="text-emerald-500" />}
        title="Energiespeicher"
        toggle={speicherEnabled}
        onToggle={() => setSpeicherEnabled(v => !v)}
      >
        {speicherEnabled && (
          <>
            <label className="label block">Leistungsmodul</label>
            <select value={speicherPowerId} onChange={e => setSpeicherPowerId(e.target.value)} className="input-field">
              <option value="">– keines –</option>
              {spPowerProds.map(p => (
                <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
              ))}
            </select>
            <label className="label block mt-2">Batteriemodul</label>
            <select value={speicherId} onChange={e => setSpeicherId(e.target.value)} className="input-field">
              {spProds.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.kapazitaet_kwh} kWh) – {Number(p.preis).toFixed(2)} €
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label block mb-0.5">Anzahl Module</label>
                <input type="number" min="1" value={speicherAnzahl}
                  onChange={e => setSpeicherAnzahl(parseInt(e.target.value) || 1)}
                  className="input-field" />
              </div>
              <div>
                <label className="label block mb-0.5">Gesamtkapazität</label>
                <div className="input-field bg-gray-50 font-bold text-primary flex items-center">
                  {speicherKwh.toLocaleString('de-AT')} kWh
                </div>
              </div>
            </div>
            <label className="label block mt-2">Notstrom-Box</label>
            <select value={backupId} onChange={e => setBackupId(e.target.value)} className="input-field">
              <option value="">– keine Notstromfunktion –</option>
              {bpProds.map(p => (
                <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
              ))}
            </select>
          </>
        )}
      </Section>

      {/* Wallbox */}
      <Section icon={<Plug size={14} weight="fill" className="text-blue-500" />} title="Wallbox (optional)">
        <select value={wallboxId} onChange={e => setWallboxId(e.target.value)} className="input-field">
          <option value="">– keine Wallbox –</option>
          {wbProds.map(p => (
            <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
          ))}
        </select>
      </Section>

      {/* Heizstab */}
      <Section icon={<Thermometer size={14} weight="fill" className="text-rose-500" />} title="PV-Heizstab (optional)">
        <select value={heizstabId} onChange={e => setHeizstabId(e.target.value)} className="input-field">
          <option value="">– kein Heizstab –</option>
          {hzProds.map(p => (
            <option key={p.id} value={p.id}>{p.name} – {Number(p.preis).toFixed(2)} €</option>
          ))}
        </select>
      </Section>

      {/* FÖRDERUNGEN */}
      {foerderungen.length > 0 && (
        <Section icon={<CurrencyEur size={14} weight="fill" className="text-emerald-600" />} title="Förderungen">
          <p className="text-[11px] text-gray-400 -mt-1 mb-1">
            Wähle anwendbare Förderungen. Beträge werden anhand Anlage berechnet, du kannst sie aber pro Position überschreiben.
          </p>
          <div className="space-y-1.5">
            {foerderungen.map(f => {
              const sel = selectedFoerderungen[f.id]
              const auto = calcFoerderung(f, foerderungsContext)
              const eligible = auto > 0
              const aktiv = !!sel?.aktiv
              const customVal = sel?.custom
              const angezeigt = aktiv ? (customVal !== undefined && customVal !== '' ? Number(customVal) : auto) : 0

              return (
                <div key={f.id} className={`rounded-lg border p-2 transition-all
                  ${aktiv ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFoerderung(f)}
                      disabled={!eligible && !aktiv}
                      className={`w-5 h-5 mt-0.5 rounded flex items-center justify-center flex-shrink-0 transition-colors
                        ${aktiv ? 'bg-emerald-500 text-white' : eligible ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-200'}`}
                    >
                      {aktiv && <span className="text-[12px]">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-medium truncate ${eligible ? 'text-secondary' : 'text-gray-400'}`}>
                        {f.name}
                      </p>
                      {f.beschreibung && (
                        <p className="text-[10px] text-gray-400 truncate">{f.beschreibung}</p>
                      )}
                      {!eligible && !aktiv && (
                        <p className="text-[10px] text-amber-500 italic">Nicht anwendbar (Anlage/Komponente fehlt)</p>
                      )}
                    </div>
                    {aktiv && (
                      <input
                        type="number"
                        step="0.01"
                        value={customVal !== undefined ? customVal : auto.toFixed(2)}
                        onChange={e => setFoerderungCustom(f.id, e.target.value)}
                        className="w-20 text-right rounded border border-emerald-200 px-1.5 py-1 text-[12px] font-semibold text-emerald-700 bg-white"
                      />
                    )}
                    {!aktiv && eligible && (
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">
                        ~{auto.toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Notiz */}
      <Section title="Notizen">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Interne Notizen zum Angebot..."
          className="input-field min-h-[60px]"
        />
      </Section>

      {/* Summen-Übersicht */}
      <div className="card bg-secondary text-white">
        <div className="space-y-1 text-[12px]">
          {gruppen.map((g, i) => {
            const sum = (g.positionen || []).reduce((s, p) => s + (p.menge || 0) * (p.preis || 0), 0)
            return (
              <div key={i} className="flex justify-between">
                <span className="text-white/70">{String(i + 1).padStart(2, '0')} {g.name}</span>
                <span>{sum.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
              </div>
            )
          })}
        </div>
        <div className="border-t border-white/20 mt-2 pt-2 space-y-0.5 text-[12px]">
          <div className="flex justify-between text-white/70">
            <span>Netto</span>
            <span>{totals.netto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>MwSt 20%</span>
            <span>{totals.mwst.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between font-bold text-base mt-1">
            <span>Brutto</span>
            <span>{totals.brutto.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</span>
          </div>

          {foerderungSumme > 0 && (
            <>
              <div className="border-t border-white/20 mt-2 pt-2 space-y-0.5">
                <p className="text-[10px] text-emerald-300 uppercase tracking-wider mb-1">Förderungen</p>
                {aktiveFoerderungen.map(f => (
                  <div key={f.id} className="flex justify-between text-emerald-200">
                    <span className="text-[11px] truncate">– {f.name}</span>
                    <span className="text-[11px]">−{Number(f._berechnet).toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/20 mt-2 pt-2">
                <div className="flex justify-between font-bold text-base">
                  <span className="text-emerald-300">Endpreis nach Förderung</span>
                  <span className="text-emerald-300">{endpreis.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €</span>
                </div>
                <p className="text-[10px] text-emerald-300/80 text-right">
                  Ersparnis: {foerderungSumme.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <button onClick={() => setShowPreview(true)} disabled={gruppen.length === 0} className="btn-secondary">
          <Eye size={14} weight="fill" /> Vorschau
        </button>
        <button onClick={() => setShowPresentation(true)} disabled={gruppen.length === 0}
          className="btn-secondary text-emerald-700 border-emerald-200">
          <Presentation size={14} weight="fill" /> Kunden-Modus
        </button>
        <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
          {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : <><FloppyDisk size={14} weight="fill" /> Speichern</>}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving || generatingPdf} className="btn-primary">
          {(saving || generatingPdf) ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : <><FilePdf size={14} weight="fill" /> PDF</>}
        </button>
      </div>

      {showPreview && (
        <PvAngebotVorschau
          kunde={kunde}
          datum={datum}
          gruppen={gruppen}
          totals={totals}
          foerderungen={aktiveFoerderungen}
          foerderungSumme={foerderungSumme}
          endpreis={endpreis}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showPresentation && (
        <KundenPraesentation
          kunde={kunde}
          kwp={kwp}
          speicherKwh={speicherEnabled ? speicherKwh : 0}
          hatWallbox={!!wallbox}
          hatHeizstab={!!heizstab}
          gruppen={gruppen}
          totals={totals}
          foerderungen={aktiveFoerderungen}
          foerderungSumme={foerderungSumme}
          endpreis={endpreis}
          onClose={() => setShowPresentation(false)}
        />
      )}
    </div>
  )
}

function Section({ icon, title, children, toggle, onToggle }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
          {icon} {title}
        </h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className={`relative w-9 h-5 rounded-full transition-colors ${toggle ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${toggle ? 'translate-x-4' : ''}`}
            />
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
