import { useState, useRef, useEffect } from 'react'
import { SpinnerGap, Plus, ArrowCounterClockwise, BookmarkSimple, FileText, ClipboardText, ArrowsClockwise } from '@phosphor-icons/react'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import SpeechInput from '../../components/SpeechInput.jsx'
import SaveOfferButton from '../../components/SaveOfferButton.jsx'
import PdfEmailSender from '../../components/PdfEmailSender.jsx'
import GewerkeBlock from '../../components/GewerkeBlock.jsx'
import OfferSummary from '../../components/OfferSummary.jsx'
import CopyField from '../../components/CopyField.jsx'
import ErgaenzungenEditor from '../../components/ErgaenzungenEditor.jsx'
import HinweiseEditor from '../../components/HinweiseEditor.jsx'
import { extractErgaenzungenHinweise } from '../../lib/speechExtract.js'
import { enrichAddressWithPlz } from '../../lib/addressLookup.js'
import EndpreisAnpassung from '../../components/EndpreisAnpassung.jsx'
import TemplateSaveDialog from '../../components/TemplateSaveDialog.jsx'
import TemplateLoadDialog from '../../components/TemplateLoadDialog.jsx'
import ProtokolleLoadDialog from '../../components/ProtokolleLoadDialog.jsx'
import { callClaude, callClaudeWithSearch, callClaudeWithCache, callClaudeWithCacheAndImages, parseJsonResponse, cleanWebSearchTags, fixPositionKosten, fixGewerkeLeistungsnummern, fixGewerkeByLeistungsnummer, enrichFromCatalog, ensureRegieMaterial, applyRegieMaterial, applyBaustelleneinrichtung, recalcBaustelleneinrichtung, stripVorschlag, detectKiVorschlag, insertPositionIntoGewerke, injectZimmerbezeichnungen, fixNullpreise, smartReinigung, sortGewerkeAndPositionen, enforceUserZeitangabe, verifyAufschlaegeGewerke, recalcNewPositionsWithModus1, deduplicatePositionen } from '../../lib/claude.js'
import { fixGewerkZuordnung } from '../../lib/fixGewerkZuordnung.js'
import { DEFAULT_PROMPT_1, DEFAULT_PROMPT_3, DEFAULT_PROMPT_EDIT, DEFAULT_PROMPT_EDIT_GEWERK, PROMPT_ADD_POSITION, buildPrompt, buildCompactCatalog, buildFilteredCatalog } from '../../lib/prompts.js'
import { updateOffer, loadOffer } from '../../lib/offers.js'
import { generateAngebotPdf } from '../../lib/pdfGenerator.js'
import MediaUpload from '../../components/MediaUpload.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import { useCatalog } from '../../hooks/useCatalog.js'
import { usePrompts } from '../../hooks/usePrompts.js'
import { useSettings } from '../../hooks/useSettings.js'
import { useTemplates } from '../../hooks/useTemplates.js'

const UNDO_KEYWORDS = ['rückgängig', 'rückgängig machen', 'zurück', 'undo', 'wiederherstellen']

const TEXT_EDIT_KEYWORDS = ['kurztext', 'langtext', 'beschreibung', 'name', 'umbenennen', 'titel', 'text ändern', 'bezeichnung']

function protectUnchangedFields(original, edited, userText) {
  const lower = userText.toLowerCase()

  const reinPreisAenderung = [
    'preis mal', 'preis auf', 'preis verdoppel', 'preis halbier',
    'mal 2', 'mal zwei', 'mal 3', 'mal drei', 'mal 4', 'mal vier',
    'doppelt so', 'halb so', 'um 10%', 'um 20%', 'um 50%',
    'euro teurer', 'euro billiger', 'euro mehr', 'euro weniger',
    '€ teurer', '€ billiger', '€ mehr', '€ weniger',
    'vk auf', 'netto auf', 'aufschlag',
  ].some(k => lower.includes(k))

  const reinMengenAenderung = [
    'menge auf', 'menge ändern', 'statt 1', 'statt 2',
    'quadratmeter statt', 'm² statt', 'lfm statt', 'stück statt',
  ].some(k => lower.includes(k))

  const reinEinheitAenderung = [
    'einheit auf', 'einheit ändern', 'statt pauschal', 'statt m²',
  ].some(k => lower.includes(k))

  const nurZahlenAenderung = reinPreisAenderung || reinMengenAenderung || reinEinheitAenderung

  console.log('EDIT: Original Kurztext:', original.leistungsname)
  console.log('EDIT: KI Kurztext:', edited.leistungsname)
  console.log('EDIT: nurZahlenAenderung:', nurZahlenAenderung)

  if (nurZahlenAenderung) {
    const inhaltsBezug = ['statt', 'änder', 'ander', 'neu', 'anpass', 'umbenenn']
      .some(k => lower.includes(k))
    if (!inhaltsBezug || reinPreisAenderung) {
      edited.leistungsname = original.leistungsname
      edited.beschreibung = original.beschreibung
      console.log('EDIT SCHUTZ: Nur Preis/Menge – Texte aus Original übernommen')
    }
  } else {
    console.log('EDIT FREI: Inhaltliche Änderung erkannt – KI darf alles ändern')
  }

  // Gesamtpreis immer aus menge × vk neu berechnen
  if (edited.menge != null && edited.vk_netto_einheit != null) {
    edited.gesamtpreis = Math.round(edited.menge * edited.vk_netto_einheit * 100) / 100
  }

  return edited
}

/**
 * Normalisiert Adresse ins Hero-Format:
 * "Straße Hausnr [Stiege X] [Top Y] [Zusatz], PLZ Ort"
 * Leerzeichen zwischen Teilen (keine Schrägstriche), Komma vor PLZ.
 */
function formatAdresse(addr) {
  if (!addr) return addr
  let result = addr
    // Schrägstriche vor Stiege/Top/Tür → Leerzeichen (Hero-Format)
    .replace(/\/\s*[Ss]tiege\s*/g, ' Stiege ')
    .replace(/\/\s*[Tt]op\s*/g, ' Top ')
    .replace(/\/\s*[Tt][uü]r\s*/g, ' Tür ')
    // "im Hof" / "/Hof" → " Hof" (kein Schrägstrich)
    .replace(/\s*\/?\s*[Ii]m\s+[Hh]of\b/gi, ' Hof')
    .replace(/\s*\/\s*[Hh]of\b/g, ' Hof')
    // Erdgeschoss/Dachgeschoss normalisieren
    .replace(/\s+[Ee]rdgeschoss\b/gi, ' EG')
    .replace(/\s+[Dd]achgeschoss\b/gi, ' DG')
    // Keller normalisieren
    .replace(/\s+[Kk]ellergeschoss\b/gi, ' Keller')
    // Stiegenhaus normalisieren
    .replace(/\s+[Ss]tiegenhaus\b/gi, ' Stiegenhaus')
    // Capitalize Stiege/Top consistently
    .replace(/\bstiege\b/gi, 'Stiege')
    .replace(/\btop\b/gi, 'Top')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim()
  return result
}

// Komma-tolerante Adresserkennung: "Straße 5, Top 3, 1010 Wien" wird vollständig erfasst
// Negative Lookbehind (?<!\d) verhindert Stopp bei "2. OG" oder "3. Stock"
const ADRESSE_EXPLICIT_RE = /(?:adresse|f[uü]r\s+die)[,:\s]+(?:ist\s+|sind\s+|lautet\s+)?(.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i
const ADRESSE_STREET_RE = /((?:[\wäöüßÄÖÜ-]+\s+){0,3}[\wäöüßÄÖÜ-]*(?:stra[sß]e|gasse|weg|platz|ring|allee|l[aä]nde|steig|zeile|hof|markt|br[uü]cke|promenade|ufer|damm|g[uü]rtel|boulevard)\s+\d+[a-z]?.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i
function extractAdresse(text) {
  if (!text) return null
  // Priority 1: Exact "Adresse: XYZ" line (from SpeechInput assembled text)
  const lineMatch = text.match(/^Adresse:\s*(.+)$/m)
  if (lineMatch) return formatAdresse(lineMatch[1].trim())
  // Priority 2: Explicit "Adresse ..." or "für die ..."
  const explicitMatch = text.match(ADRESSE_EXPLICIT_RE)
  if (explicitMatch) {
    let raw = explicitMatch[1].replace(/[,.\s]+$/, '').trim()
    // PLZ-Trim: Alles nach PLZ+Ort abschneiden (verhindert Über-Erfassung)
    const plzCut = raw.match(/^(.*?\d{4}\s+[\wÄÖÜäöü]+)\s*[,.]?\s*(.+)/)
    if (plzCut && plzCut[2] && !/^(?:top|stiege|t[uü]r|stock|og|eg|dg|ug|keller|hof)\b/i.test(plzCut[2])) {
      raw = plzCut[1].trim()
    }
    if (raw) return formatAdresse(raw)
  }
  // Priority 3: Street pattern detection
  const streetMatch = text.match(ADRESSE_STREET_RE)
  if (streetMatch) {
    let raw = streetMatch[1].replace(/[,.\s]+$/, '').trim()
    // PLZ-Trim
    const plzCut = raw.match(/^(.*?\d{4}\s+[\wÄÖÜäöü]+)\s*[,.]?\s*(.+)/)
    if (plzCut && plzCut[2] && !/^(?:top|stiege|t[uü]r|stock|og|eg|dg|ug|keller|hof)\b/i.test(plzCut[2])) {
      raw = plzCut[1].trim()
    }
    return raw ? formatAdresse(raw) : null
  }
  return null
}

// Matches: "Projekt: 100", "Projektnummer: 100", "Projekt Nummer 100",
//          "Projekt 100", "Hero Projektnummer 100", "Projekt Nr. 1234", "2024-0815"
// Captures number or alphanumeric ID (e.g. "2024-0815")
const PROJEKTNUMMER_RE = /(?:(?:hero\s+)?projekt(?:\s*(?:nummer|nr\.?|number))?|kunden?\s*name?|kunde)\s*[:\.]?\s*(.+?)(?:\.|,\s*(?:adresse|betrifft)|$)/im
function extractProjektnummer(text) {
  if (!text) return ''
  // Priority 1: exact "Kunde: XYZ" or "Projektnummer: XYZ" line
  const lineMatch = text.match(/^(?:Kunde|Projektnummer):\s*(.+)$/m)
  if (lineMatch) return lineMatch[1].trim()
  // Priority 2: free-text regex
  const m = text.match(PROJEKTNUMMER_RE)
  return m ? m[1].trim() : ''
}

/** Entfernt Adresse und unerwünschte Präfixe aus dem Betrifft-Text. */
function stripAdresseFromBetreff(betreff, adresse) {
  if (!betreff) return betreff
  let result = betreff
    // Remove KI-prefixes that should never be in Betreff
    .replace(/^(?:(?:kleines|gro[sß]es)\s+)?angebot\s+f[uü]r\s+/i, '')
    .replace(/^auftrag\s+f[uü]r\s+/i, '')
    .replace(/^betrifft:\s*/i, '')
  // Remove trailing address (exact match against extracted adresse)
  if (adresse) {
    const escaped = adresse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result
      .replace(new RegExp(`\\s*[-–,/|]\\s*${escaped}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*${escaped}\\s*$`, 'i'), '')
  }
  // Fallback: remove trailing "- Straßenname Nr..." pattern
  result = result.replace(/\s*[-–]\s+\w+(?:stra[sß]e|gasse|weg|platz|ring|allee)\s+\d+.*$/i, '')
  return result.trim()
}

/**
 * Trennt Top/Stiege/Tür/Keller/Stiegenhaus/Hof vom Straßenteil ab.
 * Diese Teile stehen in keinem Stadtplan – nur Straße + Hausnummer suchen.
 * Gibt { street, unit } zurück.
 */
const UNIT_SUFFIX_RE = /\s+((?:Stiege|Stg\.?)\s+\S+(?:\s+(?:Top|Tür)\s+[\d+\-/]+[a-z]?)?|(?:Top|Tür)\s+[\d+\-/]+[a-z]?|Keller(?:\s+\d+)?|Stiegenhaus(?:\s+und\s+Hof)?|Hof|EG|DG|OG\s*\d*)(.*)$/i
function splitAddressUnit(address) {
  if (!address) return { street: address, unit: '' }
  // Erst PLZ + Ort am Ende abtrennen (z.B. ", 1200 Wien")
  const plzMatch = address.match(/,\s*(\d{4}\s+\w+)\s*$/)
  const plzPart = plzMatch ? plzMatch[0] : ''
  const withoutPlz = plzPart ? address.slice(0, -plzPart.length).trim() : address
  // Dann Unit-Suffix abtrennen
  const unitMatch = withoutPlz.match(UNIT_SUFFIX_RE)
  if (unitMatch) {
    const street = withoutPlz.slice(0, unitMatch.index).trim()
    // unitMatch[0] enthält alles ab dem Leerzeichen – trimmen
    const unit = unitMatch[0].trim()
    return { street, unit }
  }
  return { street: withoutPlz.trim(), unit: '' }
}

// enrichAddressWithPlz ist jetzt in src/lib/addressLookup.js (Nominatim + Claude Fallback)

function getBEInfo(gewerke) {
  for (const g of (gewerke || [])) {
    for (const p of (g.positionen || [])) {
      if (p.leistungsnummer === '01-001' || p.leistungsnummer === '01-002') {
        return { nr: p.leistungsnummer, preis: p.vk_netto_einheit || 0 }
      }
    }
  }
  return null
}

function recalc(offer) {
  const o = JSON.parse(JSON.stringify(offer))
  for (const g of o.gewerke) {
    g.zwischensumme = Math.round((g.positionen || []).reduce((s, p) => s + (p.gesamtpreis || 0), 0) * 100) / 100
  }
  o.gewerke = o.gewerke.filter(g => (g.positionen || []).length > 0)
  o.netto = Math.round(o.gewerke.reduce((s, g) => s + (g.zwischensumme || 0), 0) * 100) / 100
  o.mwst = Math.round(o.netto * 20) / 100
  o.brutto = Math.round((o.netto + o.mwst) * 100) / 100
  return o
}

function Spinner({ label }) {
  return (
    <div className="card flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <SpinnerGap size={40} weight="bold" className="text-primary animate-spin" />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function KleinesAngebot({ loadOfferId = null }) {
  const [offer, setOffer] = useState(null)
  const [savedOfferId, setSavedOfferId] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [projektnummer, setProjektnummer] = useState('')
  const [lastInput, setLastInput] = useState('')
  const [inputText, setInputText] = useState('')
  const [lastAdresse, setLastAdresse] = useState(null)
  const [parseError, setParseError] = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [addingPosition, setAddingPosition] = useState(false)
  const [pendingScrollGewerk, setPendingScrollGewerk] = useState(null)
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showTemplateLoad, setShowTemplateLoad] = useState(false)
  const [showProtokollLoad, setShowProtokollLoad] = useState(false)
  const [templateInitialValue, setTemplateInitialValue] = useState(undefined)
  const [templateKey, setTemplateKey] = useState(0)
  const [mediaFiles, setMediaFiles] = useState([])
  const [ergaenzungen, setErgaenzungen] = useState([])
  const [hinweise, setHinweise] = useState([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [reinigungEntfernt, setReinigungEntfernt] = useState(false)
  const [beEntfernt, setBEEntfernt] = useState(false)
  const [showEndpreis, setShowEndpreis] = useState(false)
  const [nachlass, setNachlass] = useState(null) // { percent, betrag } | null
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { catalog, stundensaetze } = useCatalog()
  const { prompt1, prompt3 } = usePrompts()
  const { settings } = useSettings()
  const { templates, loading: templatesLoading, save: saveTemplate } = useTemplates()
  const speechInputRef = useRef(null)
  const scrollAnchorRef = useRef(null)
  const templateDialogRef = useRef(null)

  // Scroll zum Vorlagen-/Protokoll-Dialog wenn er geöffnet wird
  useEffect(() => {
    if (!showTemplateLoad && !showProtokollLoad) return
    setTimeout(() => {
      // Direkt zum Dialog scrollen, nicht zum ganzen Container
      const target = templateDialogRef.current || speechInputRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [showTemplateLoad, showProtokollLoad])

  // Scroll zur neu hinzugefügten Position
  useEffect(() => {
    if (!pendingScrollGewerk || !offer) return
    const gIdx = offer.gewerke.findIndex(g => g.name.toLowerCase() === pendingScrollGewerk.toLowerCase())
    if (gIdx === -1) { setPendingScrollGewerk(null); return }
    const pIdx = (offer.gewerke[gIdx].positionen?.length || 1) - 1
    setPendingScrollGewerk(null)
    setTimeout(() => {
      document.getElementById(`pos-${gIdx}-${pIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [offer, pendingScrollGewerk]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update wenn gespeichertes Angebot nachträglich geändert wird
  useEffect(() => {
    if (!offer || !savedOfferId) return
    updateOffer(savedOfferId, {
      betrifft: offer.betreff || '',
      angebotData: { gewerke: offer.gewerke, netto: offer.netto, mwst: offer.mwst, brutto: offer.brutto, betreff: offer.betreff, _adresse: lastAdresse || '' },
      ergaenzungen,
      hinweise,
    })
      .then(() => showToast('✓ Änderungen gespeichert'))
      .catch(err => console.error('Auto-update Fehler:', err.message))
  }, [offer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for nachtrag prefill from Protokoll on mount
  useEffect(() => {
    if (loadOfferId) return // Will be loaded from DB instead
    try {
      const nachtragRaw = sessionStorage.getItem('etkoenig_nachtrag')
      console.log('[Nachtrag KA] sessionStorage raw:', nachtragRaw)
      if (nachtragRaw) {
        sessionStorage.removeItem('etkoenig_nachtrag')
        try {
          const { projektnummer: pn, adresse: nadr, inputText: it } = JSON.parse(nachtragRaw)
          console.log('[Nachtrag KA] Geladen:', { pn, nadr, it })
          if (pn) setProjektnummer(pn)
          if (nadr) setLastAdresse(nadr)
          if (it) {
            setTemplateInitialValue(it)
            setTemplateKey(k => k + 1)
            setInputText(it)
          }
        } catch (err) {
          console.error('[Nachtrag KA] Parse Fehler:', err)
        }
      }
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing offer from DB when offerId is provided (from Angebotsliste)
  useEffect(() => {
    if (!loadOfferId) return
    // Skip if we already loaded this offer
    if (savedOfferId === loadOfferId) return
    setLoading(true)
    loadOffer(loadOfferId)
      .then(dbOffer => {
        const data = dbOffer.angebot_data || {}
        const restoredOffer = recalc({
          gewerke: data.gewerke || [],
          netto: data.netto || 0,
          mwst: data.mwst || 0,
          brutto: data.brutto || 0,
          betreff: dbOffer.betrifft || data.betreff || '',
          hero_projektnummer: dbOffer.hero_projektnummer || '',
        })
        setOffer(restoredOffer)
        setSavedOfferId(loadOfferId)
        setProjektnummer(dbOffer.hero_projektnummer || '')
        setLastAdresse(data._adresse || '')
        setLastInput(dbOffer.eingabe_text || '')
        setErgaenzungen(dbOffer.ergaenzungen || [])
        setHinweise(dbOffer.hinweise || [])
        if (dbOffer.eingabe_text) {
          setTemplateInitialValue(dbOffer.eingabe_text)
          setTemplateKey(k => k + 1)
        }
        showToast('Angebot geladen – bereit zum Bearbeiten')
      })
      .catch(err => {
        showToast('Angebot konnte nicht geladen werden: ' + err.message, 'error')
      })
      .finally(() => setLoading(false))
  }, [loadOfferId]) // eslint-disable-line react-hooks/exhaustive-deps


  function onRetry(s) {
    setRateLimitMsg(s > 0
      ? `Die KI ist gerade ausgelastet. Bitte warte einen Moment. (${s}s)`
      : '')
  }

  function pushHistory(snapshot) {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(snapshot))])
  }

  function applyBEWithToast(offerSnapshot) {
    // Wenn BE vom User gelöscht wurde → nicht recalcen
    if (beEntfernt) {
      console.log('applyBEWithToast: übersprungen (beEntfernt=true)')
      return recalc(offerSnapshot)
    }
    const oldBE = getBEInfo(offerSnapshot.gewerke)
    const newGewerke = recalcBaustelleneinrichtung(offerSnapshot.gewerke, catalog)
    const newBE = getBEInfo(newGewerke)
    if (oldBE && newBE && (oldBE.nr !== newBE.nr || Math.abs(oldBE.preis - newBE.preis) > 0.01)) {
      const formatted = Number(newBE.preis).toFixed(2).replace('.', ',')
      showToast(`Baustelleneinrichtung angepasst: ${formatted} €`)
    }
    return recalc({ ...offerSnapshot, gewerke: newGewerke })
  }

  function handleUndo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setOffer(prev)
    showToast('Rückgängig gemacht')
  }

  function handleDeleteGewerk(gIdx) {
    if (!offer) return
    const gewerkName = (offer.gewerke[gIdx]?.name || '').toLowerCase()
    pushHistory(offer)
    // Flags setzen wenn Reinigung/Gemeinkosten gelöscht werden
    if (gewerkName.includes('reinigung')) {
      setReinigungEntfernt(true)
      console.log('Reinigung-Gewerk vom User gelöscht → Flag gesetzt')
    }
    if (gewerkName.includes('gemeinkosten')) {
      setBEEntfernt(true)
      console.log('Gemeinkosten-Gewerk vom User gelöscht → Flag gesetzt')
    }
    const newGewerke = offer.gewerke.filter((_, i) => i !== gIdx)
    setOffer(recalc({ ...offer, gewerke: newGewerke }))
    showToast('Gewerk entfernt')
  }

  async function handleSaveTemplate(name) {
    setSavingTemplate(true)
    try {
      await saveTemplate({ name, inputText: inputText, type: 'klein' })
      setShowTemplateSave(false)
      showToast('Vorlage gespeichert!')
    } catch {
      showToast('Fehler beim Speichern der Vorlage.', 'error')
    } finally {
      setSavingTemplate(false)
    }
  }

  function handleLoadTemplate(text) {
    setTemplateInitialValue(text)
    setTemplateKey(k => k + 1)
    setShowTemplateLoad(false)
    showToast('Vorlage geladen – Text kann angepasst werden.')
  }

  function handleLoadProtokoll({ projektnummer: pn, adresse, inputText: it }) {
    if (pn) setProjektnummer(pn)
    if (adresse) setLastAdresse(adresse)
    if (it) {
      setTemplateInitialValue(it)
      setTemplateKey(k => k + 1)
      setInputText(it)
    }
    setShowProtokollLoad(false)
    showToast('Protokoll geladen – Text kann angepasst werden.')
  }

  function handleMediaChange(newFiles) {
    setMediaFiles(newFiles)
  }

  /** Bereinigt extrahierte Ergänzungen/Hinweise und fügt sie als einzelne Punkte ein.
   *  Kein Claude-Aufruf mehr — sofortige Anzeige ohne Halluzinationen. */
  function addExtractedEntries(rawErg, rawHin) {
    function cleanEntry(text) {
      let s = text.trim()
      // Erster Buchstabe groß
      if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1)
      // Abschließenden Punkt entfernen (wird beim Anzeigen nicht gebraucht)
      s = s.replace(/[.!?,;]+$/, '').trim()
      return s
    }

    if (rawErg.length > 0) {
      const cleaned = rawErg.map(cleanEntry).filter(s => s.length > 2)
      if (cleaned.length > 0) setErgaenzungen(prev => [...prev, ...cleaned])
    }
    if (rawHin.length > 0) {
      const cleaned = rawHin.map(cleanEntry).filter(s => s.length > 2)
      if (cleaned.length > 0) setHinweise(prev => [...prev, ...cleaned])
    }

    import.meta.env.DEV && console.log('Sprache → Ergänzungen/Hinweise direkt übernommen:', rawErg, rawHin)
  }

  async function handleSpeechResult(text) {
    // Neue Kalkulation gestartet → altes Angebot und Cache sofort löschen
    setOffer(null)
    setHistory([])
    // savedOfferId bleibt erhalten → bei erneutem Speichern wird UPDATE statt INSERT gemacht

    // Alte Ergänzungen/Hinweise zurücksetzen → frischer Start
    setErgaenzungen([])
    setHinweise([])

    // Ergänzungen/Hinweise aus Spracheingabe extrahieren — sofort anzeigen (kein KI-Aufruf)
    const { cleanedText, ergaenzungen: sprachErg, hinweise: sprachHin } = extractErgaenzungenHinweise(text)
    console.log('[Extraktion] Original:', text)
    console.log('[Extraktion] CleanedText:', cleanedText)
    console.log('[Extraktion] Ergänzungen:', sprachErg)
    console.log('[Extraktion] Hinweise:', sprachHin)
    if (sprachErg.length > 0 || sprachHin.length > 0) {
      addExtractedEntries(sprachErg, sprachHin)
    }

    // Bereinigter Text (ohne Ergänzungen/Hinweise) geht an die KI
    const offerText = cleanedText || text
    console.log('[KI-Input] offerText:', offerText)
    setLastInput(text) // Original-Text speichern
    setParseError(false)
    const regexAdresse = extractAdresse(offerText)
    setLastAdresse(regexAdresse)
    setLoading(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('ki-loading-spinner')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }
      })
    })
    try {
      // Always use the code default as primary source (prompt3 from Supabase may be stale)
      const basePrompt = DEFAULT_PROMPT_3 || prompt3
      console.log('PROMPT QUELLE:', DEFAULT_PROMPT_3 ? 'CODE DEFAULT' : 'SUPABASE')
      const systemPrompt = buildPrompt(basePrompt, stundensaetze, settings)
      const compactCatalog = buildCompactCatalog(catalog)
      const hasPhotos = mediaFiles.filter(f => !f.isVideo).length > 0
      const photoNote = hasPhotos
        ? '\n\nAnalysiere zusätzlich die beigefügten Fotos der Baustelle und ergänze Positionen die du auf den Fotos erkennst aber in der Beschreibung nicht erwähnt wurden. Markiere diese mit [FOTO-VORSCHLAG] im Kurztext.'
        : ''
      console.log('WEB SEARCH aktiviert für Modus: Kleines Angebot')
      const response = await callClaudeWithCacheAndImages(
        systemPrompt,
        `PREISLISTE:\n${compactCatalog}`,
        `ANGEBOT BESCHREIBUNG: ${offerText}${photoNote}`,
        mediaFiles,
        onRetry,
        { useWebSearch: true, maxTokens: 16000, timeoutMs: 120000 },
      )
      const parsed = parseJsonResponse(response)
      // Smarte Adress-Auswahl: NIE eine Adresse MIT PLZ durch eine OHNE PLZ ersetzen.
      // Priorität: (1) regexAdresse wenn PLZ vorhanden (SpeechInput hat bereits angereichert)
      //            (2) KI-Adresse wenn PLZ vorhanden
      //            (3) beste verfügbare Adresse → Enrichment als letzter Versuch
      const aiAdresse = formatAdresse(parsed.adresse)
      const regexHasPlz = regexAdresse && /\d{4}/.test(regexAdresse)
      const aiHasPlz = aiAdresse && /\d{4}/.test(aiAdresse)

      let finalAdresse
      if (regexHasPlz) {
        // SpeechInput hat bereits korrekt mit PLZ angereichert → beibehalten
        finalAdresse = regexAdresse
      } else if (aiHasPlz) {
        // Haupt-KI hat PLZ ermittelt → verwenden
        finalAdresse = aiAdresse
      } else {
        // Noch kein PLZ → beste verfügbare nehmen und nochmals anreichern
        finalAdresse = aiAdresse || regexAdresse
        if (finalAdresse) {
          enrichAddressWithPlz(finalAdresse).then(enriched => {
            if (enriched) setLastAdresse(enriched)
          })
        }
      }
      setLastAdresse(finalAdresse)
      // Adresse aus Betrifft entfernen falls KI sie dort eingefügt hat
      if (parsed.betreff) {
        parsed.betreff = stripAdresseFromBetreff(parsed.betreff, finalAdresse)
      }
      let gewerke = (parsed.gewerke || []).map(g => ({
        ...g,
        positionen: (g.positionen || []).map(p => {
          p.leistungsname = cleanWebSearchTags(p.leistungsname)
          p.beschreibung = cleanWebSearchTags(p.beschreibung)
          return stripVorschlag(fixPositionKosten(p))
        }),
      }))
      gewerke = enrichFromCatalog(gewerke, catalog, stundensaetze)
      gewerke = deduplicatePositionen(gewerke)
      gewerke = ensureRegieMaterial(gewerke, catalog)
      gewerke = applyRegieMaterial(gewerke, catalog)

      // MODUS-1-NACHKALKULATION: Jede NEUE Position einzeln mit Web-Search nachkalkulieren
      const modus1Prompt = buildPrompt(DEFAULT_PROMPT_1, stundensaetze, settings)
      gewerke = await recalcNewPositionsWithModus1(gewerke, modus1Prompt, onRetry, (current, total, name) => {
        setRateLimitMsg(`Nachkalkulation ${current}/${total}: ${name || 'Position'}...`)
      })

      gewerke = fixGewerkeLeistungsnummern(gewerke)
      gewerke = fixGewerkeByLeistungsnummer(gewerke)
      gewerke = fixGewerkZuordnung(gewerke)
      gewerke = applyBaustelleneinrichtung(gewerke, catalog, stundensaetze)
      gewerke = recalcBaustelleneinrichtung(gewerke, catalog)
      gewerke = fixNullpreise(gewerke, catalog, stundensaetze)
      gewerke = verifyAufschlaegeGewerke(gewerke, settings)
      gewerke = injectZimmerbezeichnungen(gewerke, text)
      gewerke = detectKiVorschlag(gewerke, text)
      gewerke = smartReinigung(gewerke, catalog, stundensaetze)
      gewerke = sortGewerkeAndPositionen(gewerke, catalog)

      // POST-PROCESSING: Falls KI trotzdem Positionen mit "Ergänzung" oder "Hinweis" erzeugt hat,
      // diese aus den Gewerken entfernen und in die Ergänzungen/Hinweise-Felder verschieben.
      const ergRe = /erg[äa]nzung/i
      const hinRe = /hinweis/i
      const extractedErg = []
      const extractedHin = []
      gewerke = gewerke.map(g => ({
        ...g,
        positionen: (g.positionen || []).filter(p => {
          const name = (p.leistungsname || '').toLowerCase()
          const desc = (p.beschreibung || '').toLowerCase()
          if (ergRe.test(name)) {
            extractedErg.push(p.beschreibung || p.leistungsname)
            console.log('[Post-Filter] Ergänzung aus Position entfernt:', p.leistungsname)
            return false
          }
          if (hinRe.test(name)) {
            extractedHin.push(p.beschreibung || p.leistungsname)
            console.log('[Post-Filter] Hinweis aus Position entfernt:', p.leistungsname)
            return false
          }
          return true
        }),
      })).filter(g => g.positionen.length > 0) // Leere Gewerke entfernen
      if (extractedErg.length > 0 || extractedHin.length > 0) {
        addExtractedEntries(extractedErg, extractedHin)
      }

      parsed.gewerke = gewerke
      const extracted = extractProjektnummer(text)
      if (extracted) setProjektnummer(extracted)
      parsed.hero_projektnummer = extracted || projektnummer
      setOffer(recalc(parsed))
      setTimeout(() => {
        const el = document.getElementById('eingabe-bereich')
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 100
          window.scrollTo({ top: y, behavior: 'smooth' })
        }
      }, 300)
    } catch (err) {
      if (err.isParseError) {
        setParseError(true)
      } else {
        showToast(err.message, 'error')
      }
    } finally {
      setLoading(false)
      setRateLimitMsg('')
    }
  }

  function handleUndoPosition(gIdx, pIdx) {
    const position = offer?.gewerke?.[gIdx]?.positionen?.[pIdx]
    if (!position?.previousState) return
    const newOffer = JSON.parse(JSON.stringify(offer))
    newOffer.gewerke[gIdx].positionen[pIdx] = {
      ...position.previousState,
      _rev: (position._rev || 0) + 1,
    }
    setOffer(applyBEWithToast(newOffer))
    showToast('Position wiederhergestellt')
  }

  async function handleEditPosition(gIdx, pIdx, text) {
    const textLower = text.toLowerCase().trim()
    if (UNDO_KEYWORDS.some(kw => textLower.includes(kw))) {
      handleUndo()
      return
    }
    setEditLoading(true)
    try {
      const position = offer.gewerke[gIdx].positionen[pIdx]
      const { previousState: _ps, _rev: _rv, ...positionForApi } = position
      const isReinigungEdit = String(positionForApi.leistungsnummer || '').startsWith('13-')
      // Gefilterte Preisliste mitschicken: Zuerst nach Änderungstext suchen, dann nach Gewerk-Name
      const gewerkName = offer.gewerke[gIdx]?.name || ''
      const catalogSearch = `${text} ${gewerkName} ${positionForApi.leistungsname || ''}`
      const filteredCatalog = buildFilteredCatalog(catalog, catalogSearch)
      const editMsg = `POSITION:\n${JSON.stringify(positionForApi, null, 2)}\n\nÄNDERUNG: ${text}\n\nPREISLISTE:\n${filteredCatalog}`
      console.log('EDIT POSITION – Prompt:', DEFAULT_PROMPT_EDIT.length, 'chars | Msg:', editMsg.length, 'chars | max_tokens: 4000')
      const t0 = Date.now()
      const response = await callClaude(DEFAULT_PROMPT_EDIT, editMsg, onRetry, 4000)
      console.log('EDIT POSITION – API Dauer:', ((Date.now() - t0) / 1000).toFixed(1), 's')
      const parsed = parseJsonResponse(response)
      // VK und Gesamtpreis der KI merken BEVOR fixPositionKosten sie durch
      // Minuten-Rundung verfälscht (Bug: "auf 180" → 183.30 wegen 20min statt 19.6)
      const aiVk = Number(parsed.vk_netto_einheit) || 0
      let updated = stripVorschlag(fixPositionKosten(parsed))
      // KI-Preis wiederherstellen wenn fixPositionKosten ihn verändert hat
      if (aiVk > 0 && Math.abs(updated.vk_netto_einheit - aiVk) > 0.005) {
        const vk = Math.round(aiVk * 100) / 100
        const mat = Math.round((Number(updated.materialkosten_einheit) || 0) * 100) / 100
        const lohn = Math.round((vk - mat) * 100) / 100
        const menge = Number(updated.menge) || 0
        updated.vk_netto_einheit = vk
        updated.lohnkosten_einheit = lohn
        updated.gesamtpreis = menge > 0 ? Math.round(menge * vk * 100) / 100 : updated.gesamtpreis
        // materialanteil/lohnanteil Prozent neu berechnen
        updated.materialanteil_prozent = vk > 0 ? Math.round((mat / vk) * 1000) / 10 : 0
        updated.lohnanteil_prozent = vk > 0 ? Math.round((100 - updated.materialanteil_prozent) * 10) / 10 : 0
        console.log(`EDIT PREIS-FIX: VK ${updated.vk_netto_einheit} → ${vk} (KI-Preis wiederhergestellt)`)
      }
      if (!updated.deleted) {
        updated = protectUnchangedFields(positionForApi, updated, text)
      }
      pushHistory(offer)
      const newOffer = JSON.parse(JSON.stringify(offer))
      if (updated.deleted) {
        // Prüfen ob eine Reinigungsposition gelöscht wird
        const gewerkName = (newOffer.gewerke[gIdx]?.name || '').toLowerCase()
        const posNr = String(positionForApi.leistungsnummer || '')
        if (gewerkName.includes('reinigung')) {
          const verbleibendePos = newOffer.gewerke[gIdx].positionen.length - 1
          if (verbleibendePos <= 0) {
            setReinigungEntfernt(true)
            console.log('Reinigung vom User gelöscht → Flag gesetzt')
          }
        }
        // Prüfen ob Baustelleneinrichtung gelöscht wird (01-001 / 01-002)
        if (posNr === '01-001' || posNr === '01-002' || gewerkName.includes('gemeinkosten')) {
          const verbleibendePos = newOffer.gewerke[gIdx].positionen.length - 1
          if (verbleibendePos <= 0) {
            setBEEntfernt(true)
            console.log('Baustelleneinrichtung/Gemeinkosten vom User gelöscht → Flag gesetzt')
          }
        }
        newOffer.gewerke[gIdx].positionen.splice(pIdx, 1)
        showToast('Position entfernt')
      } else {
        if (updated.menge != null && updated.vk_netto_einheit != null) {
          updated.gesamtpreis = Math.round(updated.menge * updated.vk_netto_einheit * 100) / 100
        }
        newOffer.gewerke[gIdx].positionen[pIdx] = {
          ...updated,
          previousState: positionForApi,
          _rev: (_rv || 0) + 1,
          ...(isReinigungEdit ? { manuellBearbeitet: true } : {}),
        }
        showToast('Position aktualisiert')
        setTimeout(() => {
          document.getElementById(`pos-${gIdx}-${pIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
      // Post-Processing: Preisliste-Preise übernehmen + Gesamtsummen neu berechnen
      newOffer.gewerke = enrichFromCatalog(newOffer.gewerke, catalog, stundensaetze)
      newOffer.gewerke = applyBaustelleneinrichtung(newOffer.gewerke, catalog, stundensaetze)
      newOffer.gewerke = recalcBaustelleneinrichtung(newOffer.gewerke, catalog)
      if (!isReinigungEdit) {
        newOffer.gewerke = smartReinigung(newOffer.gewerke, catalog, stundensaetze, { reinigungEntfernt })
      }
      setOffer(applyBEWithToast(newOffer))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setEditLoading(false)
      setRateLimitMsg('')
    }
  }

  async function handleEditGewerk(gIdx, text) {
    const textLower = text.toLowerCase().trim()
    if (UNDO_KEYWORDS.some(kw => textLower.includes(kw))) {
      handleUndo()
      return
    }
    setEditLoading(true)
    try {
      const gewerk = offer.gewerke[gIdx]
      const gewerkForApi = {
        ...gewerk,
        positionen: (gewerk.positionen || []).map(({ previousState: _ps, _rev: _rv, ...p }) => p)
      }
      const response = await callClaude(DEFAULT_PROMPT_EDIT_GEWERK,
        `GEWERK:\n${JSON.stringify(gewerkForApi, null, 2)}\n\nÄNDERUNG: ${text}`,
        onRetry)
      const updated = parseJsonResponse(response)
      updated.positionen = (updated.positionen || []).map(p => stripVorschlag(fixPositionKosten(p)))
      pushHistory(offer)
      const newOffer = JSON.parse(JSON.stringify(offer))
      newOffer.gewerke[gIdx] = updated
      setOffer(applyBEWithToast(newOffer))
      showToast('Gewerk aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setEditLoading(false)
      setRateLimitMsg('')
    }
  }

  async function handleAddPosition(text) {
    setShowAddPosition(false)
    setAddingPosition(true)
    try {
      const systemPrompt = buildPrompt(PROMPT_ADD_POSITION, stundensaetze, settings)
      const filteredCatalog = buildFilteredCatalog(catalog, text)
      const fullPrompt = systemPrompt + '\n\nPREISLISTE:\n' + filteredCatalog
      console.log('ADD POSITION – Prompt:', fullPrompt.length, 'chars | Catalog:', filteredCatalog.length, 'chars | max_tokens: 4000 | Web-Search: ON')
      const t0 = Date.now()
      const response = await callClaudeWithSearch(fullPrompt, `POSITION HINZUFÜGEN: ${text}`, onRetry, 4000)
      console.log('ADD POSITION – API Dauer:', ((Date.now() - t0) / 1000).toFixed(1), 's')
      let newPos = parseJsonResponse(response)
      if (Array.isArray(newPos)) newPos = newPos[0]

      // Enrichment nur auf die neue Position anwenden, NICHT auf bestehende
      const fakeGewerke = [{ name: newPos.gewerk || 'Allgemein', positionen: [newPos] }]
      let enriched = enrichFromCatalog(fakeGewerke, catalog, stundensaetze)
      enriched = ensureRegieMaterial(enriched, catalog)
      enriched = applyRegieMaterial(enriched, catalog)
      enriched = injectZimmerbezeichnungen(enriched, text)
      enriched = fixNullpreise(enriched, catalog, stundensaetze)
      newPos = stripVorschlag(fixPositionKosten(enriched[0]?.positionen?.[0] || newPos))
      // Zeitangabe des Users hat Vorrang über KI-Kalkulation
      newPos = enforceUserZeitangabe(newPos, text, stundensaetze)

      pushHistory(offer)
      let newGewerke = insertPositionIntoGewerke(offer.gewerke, newPos)
      newGewerke = fixGewerkeLeistungsnummern(newGewerke)
      newGewerke = detectKiVorschlag(newGewerke, text)
      newGewerke = smartReinigung(newGewerke, catalog, stundensaetze, { reinigungEntfernt })
      setOffer(applyBEWithToast(recalc({ ...offer, gewerke: newGewerke })))
      setPendingScrollGewerk(newPos.gewerk || 'Allgemein')
      showToast(`Position wurde zu ${newPos.gewerk || 'Gewerk'} hinzugefügt`)
    } catch (err) {
      showToast(err.message, 'error')
      setShowAddPosition(true)
    } finally {
      setAddingPosition(false)
      setRateLimitMsg('')
    }
  }

  function clearAll() {
    setOffer(null)
    setProjektnummer('')
    setLastAdresse(null)
    setLastInput('')
    setInputText('')
    setMediaFiles([])
    setErgaenzungen([])
    setHinweise([])
    setHistory([])
    setSavedOfferId(null)
    setReinigungEntfernt(false)
    setBEEntfernt(false)
    setNachlass(null)
    setTemplateInitialValue(undefined)
    setTemplateKey(k => k + 1)
    setShowResetConfirm(false)
  }

  return (
    <div className="space-y-4">
      {showResetConfirm && (
        <ConfirmDialog
          title="Neues Angebot starten?"
          message="Alle Eingaben und das aktuelle Angebot werden gelöscht."
          confirmLabel="Ja, neu starten"
          onConfirm={clearAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      <MediaUpload files={mediaFiles} onChange={handleMediaChange} />

      <div ref={speechInputRef} className="space-y-2">
        {showTemplateLoad && (
          <div ref={templateDialogRef}>
            <TemplateLoadDialog
              templates={templates}
              loading={templatesLoading}
              mode="klein"
              onLoad={handleLoadTemplate}
              onClose={() => setShowTemplateLoad(false)}
            />
          </div>
        )}
        {showProtokollLoad && (
          <ProtokolleLoadDialog
            onLoad={handleLoadProtokoll}
            onClose={() => setShowProtokollLoad(false)}
          />
        )}
        <SpeechInput
          key={templateKey}
          onResult={handleSpeechResult}
          onError={msg => showToast(msg, 'error')}
          showPositionTipp
          projektnummerLabel="Kunde"
          initialValue={templateInitialValue}
          disabled={loading || editLoading || addingPosition}
          onTextChange={setInputText}
          onEnrichAdresse={enrichAddressWithPlz}
          labelAction={
            <div className="flex items-center gap-1.5">
              {(offer || inputText.trim()) && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 active:text-red-400 transition-colors px-2 py-1 rounded-lg"
                  title="Neues Angebot starten"
                >
                  <ArrowsClockwise size={13} weight="regular" />
                  Neu
                </button>
              )}
              <button
                onClick={() => { setShowTemplateLoad(v => !v); setShowProtokollLoad(false) }}
                className="flex items-center gap-1.5 text-xs text-gray-400 active:text-secondary transition-colors px-2.5 py-1 rounded-lg border border-gray-200 bg-white"
              >
                <FileText size={13} weight="regular" />
                Vorlage laden
              </button>
              <button
                onClick={() => { setShowProtokollLoad(v => !v); setShowTemplateLoad(false) }}
                className="flex items-center gap-1.5 text-xs text-gray-400 active:text-secondary transition-colors px-2.5 py-1 rounded-lg border border-gray-200 bg-white"
              >
                <ClipboardText size={13} weight="regular" />
                Protokoll laden
              </button>
            </div>
          }
          bottomSlot={inputText.trim() ? (
            showTemplateSave ? (
              <TemplateSaveDialog
                onSave={handleSaveTemplate}
                onCancel={() => setShowTemplateSave(false)}
                saving={savingTemplate}
              />
            ) : (
              <button
                onClick={() => setShowTemplateSave(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm active:border-secondary active:text-secondary transition-colors"
              >
                <BookmarkSimple size={16} weight="regular" />
                Eingabe als Vorlage speichern
              </button>
            )
          ) : null}
        />
      </div>

      {/* Ergänzungen + Hinweise: IMMER sichtbar unter dem Eingabebereich */}
      <ErgaenzungenEditor ergaenzungen={ergaenzungen} onChange={setErgaenzungen} />
      <HinweiseEditor hinweise={hinweise} onChange={setHinweise} />

      <div id="ki-loading-spinner">{loading && <Spinner label={rateLimitMsg || (loadOfferId ? 'Angebot wird geladen...' : 'KI erstellt Angebot...')} />}</div>

      {parseError && !loading && (
        <div className="card border border-orange-200 bg-orange-50 text-center space-y-3 py-6">
          <p className="font-medium text-orange-700">Das Angebot konnte nicht erstellt werden.</p>
          <p className="text-sm text-orange-600">Bitte versuche es erneut.</p>
          <button
            onClick={() => handleSpeechResult(lastInput)}
            className="btn-primary"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {editLoading && <Spinner label="KI aktualisiert..." />}

      {offer && !loading && !editLoading && (
        <div className="space-y-4">
          <div ref={scrollAnchorRef} style={{ position: 'relative', top: '-80px' }} />
          <div id="eingabe-bereich" className="card bg-primary/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <CopyField label="Hero Projektnummer" value={offer.hero_projektnummer || ''} placeholder="z.B. 2024-0815" />
                <CopyField label="Adresse" value={lastAdresse || ''} onChange={setLastAdresse} placeholder="z.B. Hauptstraße 5, 1010 Wien" />
                <CopyField label="Betrifft" value={offer.betreff || ''} placeholder="z.B. Badsanierung" />
              </div>
              {history.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 text-sm text-gray-500 active:text-primary transition-colors px-3 py-2 rounded-lg bg-white border border-gray-200 active:border-primary flex-shrink-0"
                >
                  <ArrowCounterClockwise size={16} weight="regular" />
                  Rückgängig
                </button>
              )}
            </div>
          </div>
          {/* Ergänzungen/Hinweise werden jetzt IMMER über dem Spinner/Angebot angezeigt */}

          {(offer.gewerke || []).map((gewerk, gIdx) => (
            <GewerkeBlock
              key={gIdx}
              gewerk={gewerk}
              onDelete={() => handleDeleteGewerk(gIdx)}
              onEditGewerk={(text) => handleEditGewerk(gIdx, text)}
              onEditPosition={(pIdx, text) => handleEditPosition(gIdx, pIdx, text)}
              editDisabled={editLoading}
              onUndo={history.length > 0 ? handleUndo : undefined}
              onUndoPosition={(pIdx) => handleUndoPosition(gIdx, pIdx)}
              getPositionId={(pIdx) => `pos-${gIdx}-${pIdx}`}
            />
          ))}
          <OfferSummary netto={offer.netto} mwst={offer.mwst} brutto={offer.brutto} gewerke={offer.gewerke} nachlass={nachlass} />

          {/* Nachlass entfernen */}
          {nachlass && (
            <button
              onClick={() => { setNachlass(null); showToast('Nachlass entfernt') }}
              className="w-full py-2 rounded-xl border border-red-200 text-sm text-red-500 font-medium active:border-red-400 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowsClockwise size={14} weight="bold" />
              Nachlass entfernen ({nachlass.percent}%)
            </button>
          )}

          {/* Endpreise anpassen */}
          {showEndpreis ? (
            <EndpreisAnpassung
              netto={offer.netto}
              gewerke={offer.gewerke}
              nachlass={nachlass}
              onApply={(newGewerke) => {
                pushHistory(offer)
                setOffer(recalc({ ...offer, gewerke: newGewerke }))
                setShowEndpreis(false)
                showToast('Endpreise angepasst – alle Positionen aktualisiert')
              }}
              onNachlass={(nl) => {
                setNachlass(nl)
                setShowEndpreis(false)
                showToast(`Nachlass ${nl.percent}% angewendet (−${nl.betrag.toLocaleString('de-AT', { minimumFractionDigits: 2 })} €)`)
              }}
              onClose={() => setShowEndpreis(false)}
            />
          ) : (
            <button
              onClick={() => setShowEndpreis(true)}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium active:border-primary active:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <ArrowsClockwise size={16} weight="bold" />
              Endpreise anpassen
            </button>
          )}

          {addingPosition && <Spinner label="Position wird kalkuliert..." />}

          {!addingPosition && (
            showAddPosition ? (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-secondary">Neue Position hinzufügen</h3>
                  <button
                    onClick={() => setShowAddPosition(false)}
                    className="text-sm text-gray-400 active:text-gray-600"
                  >
                    Abbrechen
                  </button>
                </div>
                <SpeechInput
                  onResult={handleAddPosition}
                  onError={msg => showToast(msg, 'error')}
                  placeholder="z.B. 'Wandfliesen verfugen, Badezimmer, 8 m²'"
                  submitLabel="Position hinzufügen"
                  enableBullets={false}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowAddPosition(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium active:border-primary active:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} weight="bold" />
                Position hinzufügen
              </button>
            )
          )}

          <SaveOfferButton
            betrifft={offer.betreff || ''}
            adresse={lastAdresse || ''}
            projektnummer={offer.hero_projektnummer}
            gewerke={offer.gewerke}
            netto={nachlass ? Math.round((offer.netto - nachlass.betrag) * 100) / 100 : offer.netto}
            mwst={nachlass ? Math.round((offer.netto - nachlass.betrag) * 20) / 100 : offer.mwst}
            brutto={nachlass ? Math.round((offer.netto - nachlass.betrag) * 120) / 100 : offer.brutto}
            eingabeText={lastInput}
            mediaFiles={mediaFiles}
            ergaenzungen={ergaenzungen}
            hinweise={hinweise}
            nachlass={nachlass}
            autoSave
            existingId={savedOfferId}
            onSaved={setSavedOfferId}
          >
            {/* PDF per E-Mail – zwischen Link und Bauleiter-Versand */}
            <div className="space-y-3 pt-1 border-t border-gray-100">
              <p className="text-sm font-semibold text-secondary">PDF generieren &amp; versenden</p>
              <PdfEmailSender
                generatePdf={() => {
                  const effNetto = nachlass ? Math.round((offer.netto - nachlass.betrag) * 100) / 100 : offer.netto
                  const effMwst = nachlass ? Math.round((offer.netto - nachlass.betrag) * 20) / 100 : offer.mwst
                  const effBrutto = nachlass ? Math.round((offer.netto - nachlass.betrag) * 120) / 100 : offer.brutto
                  const datum = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  return generateAngebotPdf({
                    betrifft: offer.betreff || '',
                    adresse: lastAdresse || '',
                    projektnummer: offer.hero_projektnummer,
                    gewerke: offer.gewerke,
                    netto: effNetto,
                    mwst: effMwst,
                    brutto: effBrutto,
                    ergaenzungen,
                    hinweise,
                    nachlass,
                    userName: profile?.name || user?.email || 'Christoph Napetschnig',
                    userEmail: profile?.email || user?.email || '',
                    datum,
                  })
                }}
                betreff={`Angebot ${offer.hero_projektnummer || ''} – ${offer.betreff || ''}`}
                projektnummer={offer.hero_projektnummer}
                adresse={lastAdresse || ''}
                betrifft={offer.betreff || ''}
                pdfFilename={`Angebot-${offer.hero_projektnummer || 'neu'}-${(offer.betreff || 'Angebot').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').replace(/_+/g, '_')}.pdf`}
                angebotLink={`${window.location.origin}/angebot/${savedOfferId}`}
                type="angebot"
              />
            </div>
          </SaveOfferButton>

        </div>
      )}
    </div>
  )
}
