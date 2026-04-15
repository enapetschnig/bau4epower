import { useState, useRef, useEffect } from 'react'
import { SpinnerGap, Plus, ArrowCounterClockwise, Trash, BookmarkSimple, FileText, ClipboardText, Lightning, ArrowsClockwise } from '@phosphor-icons/react'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import SpeechInput from '../../components/SpeechInput.jsx'
import SaveOfferButton from '../../components/SaveOfferButton.jsx'
import PdfEmailSender from '../../components/PdfEmailSender.jsx'
import GewerkeBlock from '../../components/GewerkeBlock.jsx'
import OfferSummary from '../../components/OfferSummary.jsx'
import ErgaenzungenEditor from '../../components/ErgaenzungenEditor.jsx'
import HinweiseEditor from '../../components/HinweiseEditor.jsx'
import { extractErgaenzungenHinweise } from '../../lib/speechExtract.js'
import { enrichAddressWithPlz } from '../../lib/addressLookup.js'
import EndpreisAnpassung from '../../components/EndpreisAnpassung.jsx'
import TemplateSaveDialog from '../../components/TemplateSaveDialog.jsx'
import TemplateLoadDialog from '../../components/TemplateLoadDialog.jsx'
import ProtokolleLoadDialog from '../../components/ProtokolleLoadDialog.jsx'
import {
  callClaude, callClaudeWithSearch, callClaudeWithCacheAndImages, parseJsonResponse, cleanWebSearchTags,
  fixPositionKosten, fixGewerkeLeistungsnummern, fixGewerkeByLeistungsnummer,
  enrichFromCatalog, ensureRegieMaterial, applyRegieMaterial, applyBaustelleneinrichtung, recalcBaustelleneinrichtung,
  stripVorschlag, detectKiVorschlag, insertPositionIntoGewerke,
  injectZimmerbezeichnungen, fixNullpreise, smartReinigung, sortGewerkeAndPositionen,
  enforceUserZeitangabe, deduplicateReinigung, GEWERKE_REIHENFOLGE, verifyAufschlaegeGewerke,
  recalcNewPositionsWithModus1, deduplicatePositionen,
} from '../../lib/claude.js'
import { fixGewerkZuordnung } from '../../lib/fixGewerkZuordnung.js'
import MediaUpload from '../../components/MediaUpload.jsx'
import CopyField from '../../components/CopyField.jsx'
import {
  DEFAULT_PROMPT_1, DEFAULT_PROMPT_4, DEFAULT_PROMPT_EDIT, DEFAULT_PROMPT_EDIT_GEWERK,
  PROMPT_ADD_POSITION, buildPrompt, buildCompactCatalog, buildFilteredCatalog,
} from '../../lib/prompts.js'
import { updateOffer } from '../../lib/offers.js'
import { generateAngebotPdf } from '../../lib/pdfGenerator.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useToast } from '../../contexts/ToastContext.jsx'
import { useCatalog } from '../../hooks/useCatalog.js'
import { useSettings } from '../../hooks/useSettings.js'
import { usePrompts } from '../../hooks/usePrompts.js'
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

  if (edited.menge != null && edited.vk_netto_einheit != null) {
    edited.gesamtpreis = Math.round(edited.menge * edited.vk_netto_einheit * 100) / 100
  }

  return edited
}

// Komma-tolerante Adresserkennung: "Straße 5, Top 3, 1010 Wien" wird vollständig erfasst
const ADRESSE_EXPLICIT_RE = /(?:adresse|f[uü]r\s+die)[,:\s]+(?:ist\s+|sind\s+|lautet\s+)?(.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i
const ADRESSE_STREET_RE = /((?:[\wäöüßÄÖÜ-]+\s+){0,3}[\wäöüßÄÖÜ-]*(?:stra[sß]e|gasse|weg|platz|ring|allee|l[aä]nde|steig|zeile|hof|markt|br[uü]cke|promenade|ufer|damm|g[uü]rtel|boulevard)\s+\d+[a-z]?.+?)(?=\s*(?<!\d)[.!?]\s*(?:$|[A-ZÄÖÜ•])|\s+(?:betrifft|es\s+geht\s+um|geht\s+um|n[aä]chste)\b|\n|$)/i
/**
 * Normalisiert Adresse ins Hero-Format:
 * "Straße Hausnr [Stiege X] [Top Y] [Zusatz], PLZ Ort"
 * Leerzeichen zwischen Teilen (keine Schrägstriche), Komma vor PLZ.
 */
function formatAdresse(addr) {
  if (!addr) return addr
  let result = addr
    .replace(/\/\s*[Ss]tiege\s*/g, ' Stiege ')
    .replace(/\/\s*[Tt]op\s*/g, ' Top ')
    .replace(/\/\s*[Tt][uü]r\s*/g, ' Tür ')
    .replace(/\s*\/?\s*[Ii]m\s+[Hh]of\b/gi, ' Hof')
    .replace(/\s*\/\s*[Hh]of\b/g, ' Hof')
    .replace(/\s+[Ee]rdgeschoss\b/gi, ' EG')
    .replace(/\s+[Dd]achgeschoss\b/gi, ' DG')
    .replace(/\s+[Kk]ellergeschoss\b/gi, ' Keller')
    .replace(/\s+[Ss]tiegenhaus\b/gi, ' Stiegenhaus')
    .replace(/\bstiege\b/gi, 'Stiege')
    .replace(/\btop\b/gi, 'Top')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return result
}

function extractAdresse(text) {
  if (!text) return null
  // Priority 1: Exact "Adresse: XYZ" line
  const lineMatch = text.match(/^Adresse:\s*(.+)$/m)
  if (lineMatch) return formatAdresse(lineMatch[1].trim())
  // Priority 2: Explicit "Adresse ..."
  const explicitMatch = text.match(ADRESSE_EXPLICIT_RE)
  if (explicitMatch) {
    let raw = explicitMatch[1].replace(/[,.\s]+$/, '').trim()
    // PLZ-Trim: Alles nach PLZ+Ort abschneiden
    const plzCut = raw.match(/^(.*?\d{4}\s+[\wÄÖÜäöü]+)\s*[,.]?\s*(.+)/)
    if (plzCut && plzCut[2] && !/^(?:top|stiege|t[uü]r|stock|og|eg|dg|ug|keller|hof)\b/i.test(plzCut[2])) {
      raw = plzCut[1].trim()
    }
    if (raw) return formatAdresse(raw)
  }
  // Priority 3: Street pattern
  const streetMatch = text.match(ADRESSE_STREET_RE)
  if (streetMatch) {
    let raw = streetMatch[1].replace(/[,.\s]+$/, '').trim()
    const plzCut = raw.match(/^(.*?\d{4}\s+[\wÄÖÜäöü]+)\s*[,.]?\s*(.+)/)
    if (plzCut && plzCut[2] && !/^(?:top|stiege|t[uü]r|stock|og|eg|dg|ug|keller|hof)\b/i.test(plzCut[2])) {
      raw = plzCut[1].trim()
    }
    return raw ? formatAdresse(raw) : null
  }
  return null
}

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

/**
 * Trennt Top/Stiege/Tür/Keller/Stiegenhaus/Hof vom Straßenteil ab.
 * Diese Teile stehen in keinem Stadtplan – nur Straße + Hausnummer suchen.
 */
const UNIT_SUFFIX_RE = /\s+((?:Stiege|Stg\.?)\s+\S+(?:\s+(?:Top|Tür)\s+[\d+\-/]+[a-z]?)?|(?:Top|Tür)\s+[\d+\-/]+[a-z]?|Keller(?:\s+\d+)?|Stiegenhaus(?:\s+und\s+Hof)?|Hof|EG|DG|OG\s*\d*)(.*)$/i
function splitAddressUnit(address) {
  if (!address) return { street: address, unit: '' }
  const plzMatch = address.match(/,\s*(\d{4}\s+\w+)\s*$/)
  const plzPart = plzMatch ? plzMatch[0] : ''
  const withoutPlz = plzPart ? address.slice(0, -plzPart.length).trim() : address
  const unitMatch = withoutPlz.match(UNIT_SUFFIX_RE)
  if (unitMatch) {
    const street = withoutPlz.slice(0, unitMatch.index).trim()
    const unit = unitMatch[0].trim()
    return { street, unit }
  }
  return { street: withoutPlz.trim(), unit: '' }
}

/** Reichert eine Adresse mit korrekter Schreibweise + PLZ an (via Claude Trainingswissen).
 *  Verwendet callClaude (kein Web-Search) – zuverlässiger und schneller.
 *  Top/Stiege/Tür etc. werden VOR der Suche abgetrennt und danach wieder angehängt. */
// enrichAddressWithPlz ist jetzt in src/lib/addressLookup.js (Nominatim + Claude Fallback)

function stripAdresseFromBetreff(betreff, adresse) {
  if (!betreff) return betreff
  let result = betreff
    .replace(/^(?:(?:kleines|gro[sß]es)\s+)?angebot\s+f[uü]r\s+/i, '')
    .replace(/^auftrag\s+f[uü]r\s+/i, '')
    .replace(/^betrifft:\s*/i, '')
  if (adresse) {
    const escaped = adresse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result
      .replace(new RegExp(`\\s*[-–,/|]\\s*${escaped}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*${escaped}\\s*$`, 'i'), '')
  }
  result = result.replace(/\s*[-–]\s+\w+(?:stra[sß]e|gasse|weg|platz|ring|allee)\s+\d+.*$/i, '')
  return result.trim()
}

function recalc(blocks) {
  return blocks
    .filter(b => (b.positionen || []).length > 0)
    .map(b => ({
      ...b,
      zwischensumme: Math.round((b.positionen || []).reduce((s, p) => s + (p.gesamtpreis || 0), 0) * 100) / 100,
    }))
}

function Spinner({ label }) {
  return (
    <div className="card flex items-center justify-center py-8">
      <div className="flex flex-col items-center gap-3">
        <SpinnerGap size={40} weight="bold" className="text-primary animate-spin" />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function getBEInfo(blocks) {
  for (const b of (blocks || [])) {
    for (const p of (b.positionen || [])) {
      if (p.leistungsnummer === '01-001' || p.leistungsnummer === '01-002') {
        return { nr: p.leistungsnummer, preis: p.vk_netto_einheit || 0 }
      }
    }
  }
  return null
}

const GEWERK_DETECT_PROMPT = `Erkenne das Gewerk aus diesem Text. Mögliche Gewerke: ${GEWERKE_REIHENFOLGE.join(', ')}.
ANTWORTE NUR MIT JSON: {"gewerk": "..."}`

async function detectGewerkFromText(text) {
  try {
    const response = await callClaude(GEWERK_DETECT_PROMPT, text.slice(0, 500), null, 50)
    const parsed = parseJsonResponse(response)
    return GEWERKE_REIHENFOLGE.includes(parsed.gewerk) ? parsed.gewerk : null
  } catch {
    return null
  }
}

// ── GewerkEntryCard ─────────────────────────────────────────────────────────
function GewerkEntryCard({ entry, onDelete, onChangeGewerk }) {
  return (
    <div className="card space-y-2 border border-gray-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {entry.detecting ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <SpinnerGap size={12} className="animate-spin" />
              Gewerk wird erkannt…
            </div>
          ) : entry.gewerk ? (
            <span className="text-sm font-semibold text-secondary">{entry.gewerk}</span>
          ) : (
            <select
              value=""
              onChange={e => e.target.value && onChangeGewerk(entry.id, e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-600 flex-1 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">– Gewerk auswählen –</option>
              {GEWERKE_REIHENFOLGE.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-gray-300">{entry.time}</span>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-gray-300 active:text-red-400 p-1 transition-colors"
          >
            <Trash size={14} weight="regular" />
          </button>
        </div>
      </div>
      <div className="space-y-0.5">
        {entry.text.split('\n').filter(l => l.trim()).slice(0, 5).map((line, i) => (
          <div key={i} className="flex gap-1.5 text-xs text-gray-500">
            <span className="text-primary flex-shrink-0">•</span>
            <span className="leading-relaxed">{line.replace(/^[•\-*]\s*/, '')}</span>
          </div>
        ))}
        {entry.text.split('\n').filter(l => l.trim()).length > 5 && (
          <p className="text-xs text-gray-300 pl-3">+{entry.text.split('\n').filter(l => l.trim()).length - 5} weitere…</p>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function GrossesAngebot() {
  const [blocks, setBlocks] = useState([])
  const [gewerkEntries, setGewerkEntries] = useState([]) // { id, gewerk, text, time, detecting }
  const [showAddEntry, setShowAddEntry] = useState(true)
  const [savedOfferId, setSavedOfferId] = useState(null)
  const [history, setHistory] = useState([])
  const [betreff, setBetreff] = useState('')
  const [projektnummer, setProjektnummer] = useState('')
  const [loading, setLoading] = useState(false) // generating all
  const [generateProgress, setGenerateProgress] = useState(null) // { current, total }
  const [editLoading, setEditLoading] = useState(false)
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
  const [nachlass, setNachlass] = useState(null)
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { catalog, stundensaetze } = useCatalog()
  const { prompt4 } = usePrompts()
  const { settings } = useSettings()
  const { templates, loading: templatesLoading, save: saveTemplate } = useTemplates()
  const speechInputRef = useRef(null)
  const scrollAnchorRef = useRef(null)
  const addEntryRef = useRef(null)
  const templateDialogRef = useRef(null)

  // Scroll to template/protokoll dialog
  useEffect(() => {
    if (!showTemplateLoad && !showProtokollLoad) return
    setTimeout(() => {
      const target = templateDialogRef.current || speechInputRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }, [showTemplateLoad, showProtokollLoad])

  // Scroll to newly added position
  useEffect(() => {
    if (!pendingScrollGewerk || !blocks.length) return
    const gIdx = blocks.findIndex(g => g.name.toLowerCase() === pendingScrollGewerk.toLowerCase())
    if (gIdx === -1) { setPendingScrollGewerk(null); return }
    const pIdx = (blocks[gIdx].positionen?.length || 1) - 1
    setPendingScrollGewerk(null)
    setTimeout(() => {
      document.getElementById(`pos-${gIdx}-${pIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [blocks, pendingScrollGewerk]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update saved offer when blocks change
  useEffect(() => {
    if (!blocks.length || !savedOfferId) return
    const netto = blocks.reduce((s, b) => s + (b.zwischensumme || 0), 0)
    const brutto = netto * 1.2
    updateOffer(savedOfferId, {
      betrifft: stripAdresseFromBetreff(betreff, lastAdresse),
      angebotData: { gewerke: blocks, netto, mwst: netto * 0.2, brutto, betreff, _adresse: lastAdresse || '' },
    })
      .then(() => showToast('✓ Änderungen gespeichert'))
      .catch(err => console.error('Auto-update Fehler:', err.message))
  }, [blocks]) // eslint-disable-line react-hooks/exhaustive-deps

  const SESSION_KEY = 'napetschnig_gross'
  const SESSION_TTL = 4 * 60 * 60 * 1000

  // Restore from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) return
      const { ts, blocks: sb, gewerkEntries: se, projektnummer: spn, lastAdresse: sa, betreff: sbt, ergaenzungen: serg, hinweise: sh } = JSON.parse(stored)
      if (Date.now() - ts > SESSION_TTL) { sessionStorage.removeItem(SESSION_KEY); return }
      if (sb?.length > 0) setBlocks(sb)
      if (se?.length > 0) { setGewerkEntries(se); setShowAddEntry(false) }
      if (spn) setProjektnummer(spn)
      if (sa) setLastAdresse(sa)
      if (sbt) setBetreff(sbt)
      if (serg) setErgaenzungen(serg)
      if (sh) setHinweise(sh)
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to sessionStorage
  useEffect(() => {
    if (!blocks.length && !gewerkEntries.length) return
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        ts: Date.now(),
        blocks,
        gewerkEntries: gewerkEntries.map(e => ({ ...e, detecting: false })),
        projektnummer,
        lastAdresse,
        betreff,
        ergaenzungen,
        hinweise,
      }))
    } catch { /* ignore */ }
  }, [blocks, gewerkEntries, projektnummer, lastAdresse, betreff, ergaenzungen, hinweise]) // eslint-disable-line react-hooks/exhaustive-deps

  function onRetry(s) {
    setRateLimitMsg(s > 0 ? `KI ausgelastet. Bitte warte… (${s}s)` : '')
  }

  function pushHistory(snapshot) {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(snapshot))])
  }

  function commitBlocks(newBlocks, prevBlocks = null) {
    const oldBE = prevBlocks ? getBEInfo(prevBlocks) : null
    const corrected = deduplicatePositionen(fixGewerkZuordnung(fixGewerkeByLeistungsnummer(enrichFromCatalog(newBlocks, catalog, stundensaetze))))
    let withFormulas, withBE
    if (beEntfernt) {
      // BE vom User gelöscht → nicht neu berechnen
      console.log('commitBlocks: BE-Recalc übersprungen (beEntfernt=true)')
      withFormulas = recalc(corrected)
      withBE = withFormulas
    } else {
      withFormulas = applyBaustelleneinrichtung(recalc(corrected), catalog, stundensaetze)
      withBE = recalcBaustelleneinrichtung(withFormulas, catalog)
    }
    const withReinigung = smartReinigung(withBE, catalog, stundensaetze, { reinigungEntfernt })
    const final = sortGewerkeAndPositionen(withReinigung, catalog)
    if (oldBE) {
      const newBE = getBEInfo(final)
      if (newBE && (oldBE.nr !== newBE.nr || Math.abs(oldBE.preis - newBE.preis) > 0.01)) {
        const formatted = Number(newBE.preis).toFixed(2).replace('.', ',')
        showToast(`Baustelleneinrichtung angepasst: ${formatted} €`)
      }
    }
    setBlocks(final)
  }

  function handleUndo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setBlocks(prev)
    showToast('Rückgängig gemacht')
  }

  async function handleSaveTemplate(name) {
    const text = gewerkEntries.map(e => `Gewerk ${e.gewerk || '?'}:\n${e.text}`).join('\n\n')
    setSavingTemplate(true)
    try {
      await saveTemplate({ name, inputText: text, type: 'gross' })
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
    setShowAddEntry(true)
    showToast('Vorlage geladen – Text kann angepasst werden.')
  }

  function handleLoadProtokoll({ projektnummer: pn, adresse, inputText: it }) {
    if (pn) setProjektnummer(pn)
    if (adresse) setLastAdresse(adresse)
    if (it) {
      setTemplateInitialValue(it)
      setTemplateKey(k => k + 1)
      setShowAddEntry(true)
    }
    setShowProtokollLoad(false)
    showToast('Protokoll geladen – Text kann angepasst werden.')
  }

  // ── Text bereinigen: Metafelder (Projektnummer, Adresse, Betrifft) entfernen ─
  function cleanEntryText(text) {
    let t = text
    // "Erstes Gewerk", "erste Ansage" etc. am Anfang
    t = t.replace(/^(?:erstes?\s+gewerk|erste\s+ansage)[,.\s]*/i, '')
    // Projektnummer-Angabe
    t = t.replace(/(?:hero\s+)?projekt(?:nummer)?\s*:?\s*\S+[,.\s]*/gi, '')
    // Adresse-Angabe (explizit mit Schlüsselwort)
    t = t.replace(/(?:adresse|für\s+die\s+adresse)\s+[^,.!?\n]+[,.\s]*/gi, '')
    // Straße + Hausnummer (+Top/Hof) am Satzanfang oder nach Komma (auch mehrteilige Straßennamen)
    t = t.replace(/\b\w+(?:\s+\w+){0,2}\s*(?:straße|strasse|gasse|weg|platz|ring|allee)\s+\d+[^,.]*[,.\s]*/gi, '')
    // Betrifft-Angabe
    t = t.replace(/betrifft\s*:?\s*[^,.!?\n]+[,.\s]*/gi, '')
    // Mehrfache Leerzeichen und führende/abschließende Whitespace
    return t.replace(/\s{2,}/g, ' ').trim()
  }

  // ── Positionstext in Bullet-Lines aufteilen ──────────────────────────────────
  function splitToBullets(text) {
    const lines = text
      .split(/nächste\s+position[,.\s]*/gi)
      .flatMap(chunk => chunk.split(/\n+/))
      .flatMap(chunk => chunk.split(/(?<=\.)\s+(?=[A-ZÄÖÜ])/))
      .map(l => l.replace(/^[•\-*\d.]+\s*/, '').trim())
      .filter(l => l.length > 2)
    return lines.join('\n')
  }

  /** Formatiert extrahierte Ergänzungen/Hinweise per Claude und fügt sie als einzelne Punkte ein. */
  async function formatAndAddEntries(rawErg, rawHin) {
    const FORMAT_PROMPT = `Bereinige den folgenden gesprochenen Text für ein Bauangebot. Teile ihn in einzelne Punkte auf. Halte dich dabei SEHR NAH am Originaltext – ändere nur Grammatik, Rechtschreibung und mache aus Umgangssprache korrektes Deutsch. NICHT umformulieren, NICHT ergänzen, NICHT interpretieren, KEINE eigenen Inhalte hinzufügen. Nur aufräumen was gesagt wurde.

ANTWORTE NUR MIT JSON:
{"punkte": ["Punkt 1", "Punkt 2"]}

NUR JSON, keine Erklärung.`

    for (const raw of rawErg) {
      try {
        const result = await callClaude(FORMAT_PROMPT, raw, null, 512)
        const data = parseJsonResponse(result)
        const punkte = Array.isArray(data?.punkte) ? data.punkte.filter(p => p?.trim()) : []
        setErgaenzungen(prev => [...prev, ...(punkte.length > 0 ? punkte : [raw])])
      } catch {
        setErgaenzungen(prev => [...prev, raw])
      }
    }

    for (const raw of rawHin) {
      try {
        const result = await callClaude(FORMAT_PROMPT, raw, null, 512)
        const data = parseJsonResponse(result)
        const punkte = Array.isArray(data?.punkte) ? data.punkte.filter(p => p?.trim()) : []
        setHinweise(prev => [...prev, ...(punkte.length > 0 ? punkte : [raw])])
      } catch {
        setHinweise(prev => [...prev, raw])
      }
    }

    import.meta.env.DEV && console.log('Sprache → Ergänzungen/Hinweise formatiert:', rawErg, rawHin)
  }

  // ── Entry hinzufügen (nach Spracheingabe) ──────────────────────────────────
  async function handleAddEntry(text) {
    if (!text.trim()) return

    // Ergänzungen/Hinweise aus Spracheingabe extrahieren + KI-formatieren
    const { cleanedText, ergaenzungen: sprachErg, hinweise: sprachHin } = extractErgaenzungenHinweise(text)
    if (sprachErg.length > 0 || sprachHin.length > 0) {
      formatAndAddEntries(sprachErg, sprachHin)
    }

    // Bereinigter Text (ohne Ergänzungen/Hinweise) geht weiter
    let entryText = cleanedText || text

    // Erstes Gewerk: Projektnummer/Adresse/Betrifft extrahieren und Text bereinigen
    if (gewerkEntries.length === 0) {
      const pn = extractProjektnummer(text)
      if (pn) setProjektnummer(pn)
      const adr = extractAdresse(text)
      if (adr) {
        setLastAdresse(adr)
        // IMMER Adresse via Web prüfen: korrekte Schreibweise + PLZ ergänzen
        enrichAddressWithPlz(adr).then(enriched => {
          if (enriched) setLastAdresse(enriched)
        })
      }
      // Betreff extrahieren: alles nach "betrifft" bis zum nächsten Satzzeichen / Zeilenende
      const betrifftMatch = text.match(/betrifft\s*:?\s*([^.,\n!?]{3,80})/i)
      if (betrifftMatch) setBetreff(betrifftMatch[1].trim())
      entryText = cleanEntryText(entryText)
    }

    entryText = splitToBullets(entryText)

    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const newEntry = { id, gewerk: '', text: entryText, time, detecting: true }
    setGewerkEntries(prev => [...prev, newEntry])
    setShowAddEntry(false)

    // Gewerk async erkennen
    const gewerk = await detectGewerkFromText(entryText)
    setGewerkEntries(prev => prev.map(e =>
      e.id === id ? { ...e, gewerk: gewerk || '', detecting: false } : e
    ))
  }

  function removeEntry(id) {
    setGewerkEntries(prev => prev.filter(e => e.id !== id))
  }

  function updateEntryGewerk(id, gewerk) {
    setGewerkEntries(prev => prev.map(e => e.id === id ? { ...e, gewerk } : e))
  }

  function clearAll() {
    setGewerkEntries([])
    setBlocks([])
    setProjektnummer('')
    setLastAdresse(null)
    setBetreff('')
    setErgaenzungen([])
    setHinweise([])
    setHistory([])
    setShowAddEntry(true)
    setShowResetConfirm(false)
    setReinigungEntfernt(false)
    setBEEntfernt(false)
    setNachlass(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  // ── Alle Gewerke generieren ────────────────────────────────────────────────
  async function handleGenerateAll() {
    if (gewerkEntries.length === 0) return
    // Warten bis alle Gewerke erkannt sind
    const stillDetecting = gewerkEntries.some(e => e.detecting)
    if (stillDetecting) {
      showToast('Gewerk-Erkennung läuft noch – bitte kurz warten.', 'error')
      return
    }

    setLoading(true)
    setParseError(false)
    const allBlocks = []

    try {
      const basePrompt = DEFAULT_PROMPT_4 || prompt4
      console.log('PROMPT QUELLE:', DEFAULT_PROMPT_4 ? 'CODE DEFAULT' : 'SUPABASE')
      const systemPrompt = buildPrompt(basePrompt, stundensaetze, settings) +
        '\n\nGib NUR einen einzelnen Gewerk-Block zurück als JSON: { "name": "...", "positionen": [...], "zwischensumme": 0.00 }'
      const compactCatalog = buildCompactCatalog(catalog)

      for (let i = 0; i < gewerkEntries.length; i++) {
        const entry = gewerkEntries[i]
        setGenerateProgress({ current: i + 1, total: gewerkEntries.length, label: entry.gewerk || `Gewerk ${i + 1}` })

        try {
          const hasPhotos = i === 0 && mediaFiles.filter(f => !f.isVideo).length > 0
          const photoNote = hasPhotos
            ? '\n\nAnalysiere zusätzlich die beigefügten Fotos und ergänze Positionen die du erkennst. Markiere diese mit [FOTO-VORSCHLAG] im Kurztext.'
            : ''

          // Gewerk-Hint voranstellen falls erkannt
          const gewerkHint = entry.gewerk ? `Gewerk: ${entry.gewerk}\n` : ''
          const userMsg = `PREISLISTE:\n${compactCatalog}\n\nGEWERK BESCHREIBUNG: ${gewerkHint}${entry.text}${photoNote}`

          console.log('WEB SEARCH aktiviert für Modus: Großes Angebot')
          const response = i === 0 && hasPhotos
            ? await callClaudeWithCacheAndImages(systemPrompt, `PREISLISTE:\n${compactCatalog}`, `GEWERK BESCHREIBUNG: ${gewerkHint}${entry.text}${photoNote}`, mediaFiles, onRetry, { useWebSearch: true, maxTokens: 8000, timeoutMs: 120000 })
            : await callClaudeWithSearch(systemPrompt, userMsg, onRetry, 8000)

          const data = parseJsonResponse(response)
          const rawBlock = data.gewerke ? data.gewerke[0] : data
          if (entry.gewerk && rawBlock.name !== entry.gewerk) rawBlock.name = entry.gewerk
          rawBlock.positionen = (rawBlock.positionen || []).map(p => {
            p.leistungsname = cleanWebSearchTags(p.leistungsname)
            p.beschreibung = cleanWebSearchTags(p.beschreibung)
            return stripVorschlag(fixPositionKosten(p))
          })
          const enrichedArr = deduplicatePositionen(enrichFromCatalog(fixGewerkeLeistungsnummern([rawBlock]), catalog, stundensaetze))
          let [enrichedBlock] = enrichedArr
          const modus1Prompt = buildPrompt(DEFAULT_PROMPT_1, stundensaetze, settings)
          const [recalcedBlock] = await recalcNewPositionsWithModus1([enrichedBlock], modus1Prompt, onRetry, (cur, tot, name) => {
            setGenerateProgress(prev => ({ ...prev, label: `${entry.gewerk || 'Gewerk'} – Nachkalkulation ${cur}/${tot}: ${name || ''}` }))
          })
          enrichedBlock = recalcedBlock

          const [ensuredBlock] = ensureRegieMaterial([enrichedBlock], catalog)
          const [regieBlock] = applyRegieMaterial([ensuredBlock], catalog)
          const [nullfixedBlock] = fixNullpreise([regieBlock], catalog, stundensaetze)
          const [verifiedBlock] = verifyAufschlaegeGewerke([nullfixedBlock], settings)
          const [zimmerBlock] = injectZimmerbezeichnungen([verifiedBlock], entry.text)
          const [vorschlagBlock] = detectKiVorschlag([zimmerBlock], entry.text)
          const [fixedBlock] = deduplicateReinigung([vorschlagBlock])
          allBlocks.push(fixedBlock)
        } catch (err) {
          console.error(`Fehler bei Gewerk ${entry.gewerk || i + 1}:`, err.message)
          showToast(`Fehler bei "${entry.gewerk || 'Gewerk ' + (i + 1)}" – wird übersprungen.`, 'error')
        }
      }

      if (allBlocks.length === 0) {
        setParseError(true)
        return
      }

      commitBlocks(allBlocks, [])
      setGewerkEntries([]) // Eingabe-Liste leeren nach Generierung
      setTimeout(() => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
      setGenerateProgress(null)
      setRateLimitMsg('')
    }
  }

  // ── Edit functions (unchanged) ─────────────────────────────────────────────
  function handleUndoPosition(blockIdx, pIdx) {
    const position = blocks?.[blockIdx]?.positionen?.[pIdx]
    if (!position?.previousState) return
    const newBlocks = JSON.parse(JSON.stringify(blocks))
    newBlocks[blockIdx].positionen[pIdx] = { ...position.previousState, _rev: (position._rev || 0) + 1 }
    commitBlocks(newBlocks, blocks)
    showToast('Position wiederhergestellt')
  }

  async function handleEditPosition(blockIdx, pIdx, text) {
    if (UNDO_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) { handleUndo(); return }
    setEditLoading(true)
    try {
      const position = blocks[blockIdx].positionen[pIdx]
      const { previousState: _ps, _rev: _rv, ...positionForApi } = position
      const isReinigungEdit = String(positionForApi.leistungsnummer || '').startsWith('13-')
      // Gefilterte Preisliste mitschicken
      const blockName = blocks[blockIdx]?.name || ''
      const catalogSearch = `${text} ${blockName} ${positionForApi.leistungsname || ''}`
      const filteredCatalog = buildFilteredCatalog(catalog, catalogSearch)
      const response = await callClaude(DEFAULT_PROMPT_EDIT,
        `POSITION:\n${JSON.stringify(positionForApi, null, 2)}\n\nÄNDERUNG: ${text}\n\nPREISLISTE:\n${filteredCatalog}`, onRetry, 4000)
      const parsed = parseJsonResponse(response)
      const aiVk = Number(parsed.vk_netto_einheit) || 0
      let updated = stripVorschlag(fixPositionKosten(parsed))
      // KI-Preis wiederherstellen wenn fixPositionKosten ihn durch Minuten-Rundung verändert hat
      if (aiVk > 0 && Math.abs(updated.vk_netto_einheit - aiVk) > 0.005) {
        const vk = Math.round(aiVk * 100) / 100
        const mat = Math.round((Number(updated.materialkosten_einheit) || 0) * 100) / 100
        updated.vk_netto_einheit = vk
        updated.lohnkosten_einheit = Math.round((vk - mat) * 100) / 100
        updated.gesamtpreis = (Number(updated.menge) || 0) > 0 ? Math.round((Number(updated.menge)) * vk * 100) / 100 : updated.gesamtpreis
        updated.materialanteil_prozent = vk > 0 ? Math.round((mat / vk) * 1000) / 10 : 0
        updated.lohnanteil_prozent = vk > 0 ? Math.round((100 - updated.materialanteil_prozent) * 10) / 10 : 0
        console.log(`EDIT PREIS-FIX: VK wiederhergestellt auf ${vk}`)
      }
      if (!updated.deleted) {
        updated = protectUnchangedFields(positionForApi, updated, text)
      }
      pushHistory(blocks)
      const newBlocks = JSON.parse(JSON.stringify(blocks))
      if (updated.deleted) {
        const blockName = (newBlocks[blockIdx]?.name || '').toLowerCase()
        const posNr = String(positionForApi.leistungsnummer || '')
        // Prüfen ob Reinigungsposition gelöscht wird
        if (blockName.includes('reinigung')) {
          const verbleibendePos = newBlocks[blockIdx].positionen.length - 1
          if (verbleibendePos <= 0) {
            setReinigungEntfernt(true)
            console.log('Reinigung-Position vom User gelöscht → Flag gesetzt')
          }
        }
        // Prüfen ob Baustelleneinrichtung gelöscht wird
        if (posNr === '01-001' || posNr === '01-002' || blockName.includes('gemeinkosten')) {
          const verbleibendePos = newBlocks[blockIdx].positionen.length - 1
          if (verbleibendePos <= 0) {
            setBEEntfernt(true)
            console.log('BE-Position vom User gelöscht → Flag gesetzt')
          }
        }
        newBlocks[blockIdx].positionen.splice(pIdx, 1)
        commitBlocks(newBlocks, blocks)
        showToast('Position entfernt')
      } else {
        if (updated.menge != null && updated.vk_netto_einheit != null)
          updated.gesamtpreis = Math.round(updated.menge * updated.vk_netto_einheit * 100) / 100
        newBlocks[blockIdx].positionen[pIdx] = {
          ...updated,
          previousState: positionForApi,
          _rev: (_rv || 0) + 1,
          ...(isReinigungEdit ? { manuellBearbeitet: true } : {}),
        }
        commitBlocks(newBlocks, blocks)
        showToast('Position aktualisiert')
        setTimeout(() => {
          document.getElementById(`pos-${blockIdx}-${pIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleEditGewerk(blockIdx, text) {
    if (UNDO_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) { handleUndo(); return }
    setEditLoading(true)
    try {
      const gewerk = blocks[blockIdx]
      const gewerkForApi = { ...gewerk, positionen: (gewerk.positionen || []).map(({ previousState: _ps, _rev: _rv, ...p }) => p) }
      const response = await callClaude(DEFAULT_PROMPT_EDIT_GEWERK,
        `GEWERK:\n${JSON.stringify(gewerkForApi, null, 2)}\n\nÄNDERUNG: ${text}`, onRetry)
      const updated = parseJsonResponse(response)
      updated.positionen = (updated.positionen || []).map(p => stripVorschlag(fixPositionKosten(p)))
      pushHistory(blocks)
      const newBlocks = JSON.parse(JSON.stringify(blocks))
      newBlocks[blockIdx] = updated
      commitBlocks(newBlocks, blocks)
      showToast('Gewerk aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setEditLoading(false)
      setRateLimitMsg('')
    }
  }

  function deleteBlock(idx) {
    const blockName = (blocks[idx]?.name || '').toLowerCase()
    // Wenn Reinigung-Block gelöscht wird → Flag setzen
    if (blockName.includes('reinigung')) {
      setReinigungEntfernt(true)
      console.log('Reinigung-Block vom User gelöscht → Flag gesetzt')
    }
    // Wenn Gemeinkosten-Block gelöscht wird → BE-Flag setzen
    if (blockName.includes('gemeinkosten')) {
      setBEEntfernt(true)
      console.log('Gemeinkosten-Block vom User gelöscht → BE-Flag gesetzt')
    }
    pushHistory(blocks)
    commitBlocks(blocks.filter((_, i) => i !== idx), blocks)
  }

  async function handleAddPosition(text) {
    setShowAddPosition(false)
    setAddingPosition(true)
    try {
      const systemPrompt = buildPrompt(PROMPT_ADD_POSITION, stundensaetze, settings)
      const filteredCatalog = buildFilteredCatalog(catalog, text)
      const fullPrompt = systemPrompt + '\n\nPREISLISTE:\n' + filteredCatalog
      console.log('ADD POSITION (Großes Angebot) – Web-Search: ON | max_tokens: 4000')
      const response = await callClaudeWithSearch(fullPrompt, `POSITION HINZUFÜGEN: ${text}`, onRetry, 4000)
      let newPos = parseJsonResponse(response)
      if (Array.isArray(newPos)) newPos = newPos[0]
      const fakeGewerke = [{ name: newPos.gewerk || 'Allgemein', positionen: [newPos] }]
      let enriched = enrichFromCatalog(fakeGewerke, catalog, stundensaetze)
      enriched = ensureRegieMaterial(enriched, catalog)
      enriched = applyRegieMaterial(enriched, catalog)
      enriched = injectZimmerbezeichnungen(enriched, text)
      enriched = fixNullpreise(enriched, catalog, stundensaetze)
      newPos = stripVorschlag(fixPositionKosten(enriched[0]?.positionen?.[0] || newPos))
      newPos = enforceUserZeitangabe(newPos, text, stundensaetze)
      pushHistory(blocks)
      let newGewerke = insertPositionIntoGewerke(blocks, newPos)
      newGewerke = fixGewerkeLeistungsnummern(newGewerke)
      newGewerke = detectKiVorschlag(newGewerke, text)
      commitBlocks(newGewerke, blocks)
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

  const netto = blocks.reduce((sum, b) => sum + (b.zwischensumme || 0), 0)
  const mwst = netto * 0.2
  const brutto = netto + mwst
  const hasEntries = gewerkEntries.length > 0
  const allDetected = !gewerkEntries.some(e => e.detecting)

  return (
    <div className="space-y-4">
      {showResetConfirm && (
        <ConfirmDialog
          title="Neues Angebot starten?"
          message="Alle Gewerke und Eingaben werden gelöscht."
          confirmLabel="Ja, neu starten"
          onConfirm={clearAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      <MediaUpload files={mediaFiles} onChange={setMediaFiles} />

      {/* ── INPUT PHASE (wenn noch keine Gewerke generiert) ── */}
      {blocks.length === 0 && (
        <div className="space-y-3">
          {/* Template / Protokoll Load Dialoge */}
          <div ref={speechInputRef}>
            {showTemplateLoad && (
              <div ref={templateDialogRef}>
                <TemplateLoadDialog
                  templates={templates}
                  loading={templatesLoading}
                  mode="gross"
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
          </div>

          {/* Gewerk-Einträge */}
          {hasEntries && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-secondary">
                  {gewerkEntries.length} Gewerk{gewerkEntries.length !== 1 ? 'e' : ''} erfasst
                </h2>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 active:text-red-400 transition-colors px-2 py-1 rounded-lg"
                >
                  <ArrowsClockwise size={12} weight="regular" />
                  Neu starten
                </button>
              </div>
              {gewerkEntries.map(entry => (
                <GewerkEntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={removeEntry}
                  onChangeGewerk={updateEntryGewerk}
                />
              ))}
            </div>
          )}

          {/* Spracheingabe für neues Gewerk */}
          {showAddEntry && (
            <div ref={addEntryRef} className="space-y-2">
              <SpeechInput
                key={templateKey}
                onResult={handleAddEntry}
                onError={msg => showToast(msg, 'error')}
                projektnummerLabel="Kunde"
                initialValue={templateInitialValue}
                disabled={loading}
                showGrossTipp={!hasEntries}
                enableBullets={!hasEntries}
                onEnrichAdresse={enrichAddressWithPlz}
                positionenLabel="Positionen (erstes Gewerk)"
                positionenPlaceholder={'• Gewerk Abbruch: Abbruch Bodenfliesen 8m²\n• Gewerk Maler: Wände streichen 50m²\n• ...'}
                placeholder="Nächstes Gewerk ansagen, z.B. &quot;Gewerk Maler: Wände und Decken ausmalen 120m²&quot;"
                submitLabel={hasEntries ? 'Gewerk hinzufügen' : 'Erstes Gewerk hinzufügen'}
                labelAction={
                  <div className="flex items-center gap-1.5">
                    {hasEntries && (
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
                bottomSlot={hasEntries ? (
                  <button
                    onClick={() => setShowAddEntry(false)}
                    className="text-xs text-gray-400 active:text-gray-600 text-center w-full py-1"
                  >
                    Abbrechen
                  </button>
                ) : null}
              />
            </div>
          )}

          {/* Aktions-Buttons */}
          {hasEntries && !showAddEntry && (
            <div className="space-y-2">
              {/* + Gewerk hinzufügen */}
              <button
                onClick={() => { setShowAddEntry(true); setTemplateInitialValue(undefined) }}
                disabled={loading}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium active:border-primary active:text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Plus size={16} weight="bold" />
                Gewerk hinzufügen
              </button>

              {/* Vorlage speichern */}
              {showTemplateSave ? (
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
              )}

              {/* GENERIEREN */}
              {loading ? (
                <div className="card py-6 text-center space-y-2">
                  <SpinnerGap size={36} weight="bold" className="text-primary animate-spin mx-auto" />
                  {generateProgress && (
                    <p className="text-sm text-gray-500">
                      Gewerk {generateProgress.current} von {generateProgress.total}: <strong>{generateProgress.label}</strong>
                    </p>
                  )}
                  {rateLimitMsg && <p className="text-xs text-orange-500">{rateLimitMsg}</p>}
                </div>
              ) : (
                <button
                  onClick={handleGenerateAll}
                  disabled={!allDetected}
                  className="w-full py-4 rounded-xl bg-primary text-white font-bold text-base active:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Lightning size={20} weight="fill" />
                  {allDetected
                    ? `Angebot generieren (${gewerkEntries.length} Gewerk${gewerkEntries.length !== 1 ? 'e' : ''})`
                    : 'Gewerk-Erkennung läuft…'
                  }
                </button>
              )}
            </div>
          )}

          {parseError && !loading && (
            <div className="card border border-orange-200 bg-orange-50 text-center space-y-3 py-6">
              <p className="font-medium text-orange-700">Das Angebot konnte nicht erstellt werden.</p>
              <button onClick={handleGenerateAll} className="btn-primary">Erneut versuchen</button>
            </div>
          )}
        </div>
      )}

      {/* Ergänzungen/Hinweise: IMMER sichtbar wenn Einträge vorhanden */}
      {(ergaenzungen.length > 0 || hinweise.length > 0) && (
        <div className="space-y-4">
          {ergaenzungen.length > 0 && <ErgaenzungenEditor ergaenzungen={ergaenzungen} onChange={setErgaenzungen} />}
          {hinweise.length > 0 && <HinweiseEditor hinweise={hinweise} onChange={setHinweise} />}
        </div>
      )}

      {/* ── RESULT PHASE (generierte Gewerk-Blöcke) ── */}
      {blocks.length > 0 && (
        <div className="space-y-4">
          <div ref={scrollAnchorRef} style={{ position: 'relative', top: '-80px' }} />

          {/* Meta */}
          <div className="card bg-primary/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <CopyField label="Hero Projektnummer" value={projektnummer || ''} placeholder="z.B. 2024-0815" />
                <CopyField label="Adresse" value={lastAdresse || ''} onChange={setLastAdresse} placeholder="z.B. Hauptstraße 5, 1010 Wien" />
                <CopyField label="Betrifft" value={stripAdresseFromBetreff(betreff, lastAdresse) || ''} placeholder="z.B. Badsanierung" />
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

          <ErgaenzungenEditor ergaenzungen={ergaenzungen} onChange={setErgaenzungen} />
          <HinweiseEditor hinweise={hinweise} onChange={setHinweise} />

          <div className="flex items-center justify-between">
            <h2 className="section-title">Gewerk-Blöcke ({blocks.length})</h2>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 text-xs text-gray-400 active:text-red-400 transition-colors px-2 py-1 rounded-lg"
            >
              <ArrowsClockwise size={12} weight="regular" />
              Neu starten
            </button>
          </div>

          {editLoading && <Spinner label="KI aktualisiert..." />}

          {blocks.map((block, idx) => (
            <GewerkeBlock
              key={idx}
              gewerk={block}
              onDelete={() => deleteBlock(idx)}
              onEditGewerk={(text) => handleEditGewerk(idx, text)}
              onEditPosition={(pIdx, text) => handleEditPosition(idx, pIdx, text)}
              editDisabled={editLoading}
              onUndo={history.length > 0 ? handleUndo : undefined}
              onUndoPosition={(pIdx) => handleUndoPosition(idx, pIdx)}
              getPositionId={(pIdx) => `pos-${idx}-${pIdx}`}
            />
          ))}

          <OfferSummary netto={netto} mwst={mwst} brutto={brutto} gewerke={blocks} nachlass={nachlass} />

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
              netto={netto}
              gewerke={blocks}
              nachlass={nachlass}
              onApply={(newBlocks) => {
                pushHistory(blocks)
                commitBlocks(newBlocks, blocks)
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
                  <button onClick={() => setShowAddPosition(false)} className="text-sm text-gray-400">Abbrechen</button>
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
            betrifft={stripAdresseFromBetreff(betreff, lastAdresse)}
            adresse={lastAdresse || ''}
            projektnummer={projektnummer}
            gewerke={blocks}
            netto={nachlass ? Math.round((netto - nachlass.betrag) * 100) / 100 : netto}
            mwst={nachlass ? Math.round((netto - nachlass.betrag) * 20) / 100 : mwst}
            brutto={nachlass ? Math.round((netto - nachlass.betrag) * 120) / 100 : brutto}
            eingabeText={gewerkEntries.map(e => `${e.gewerk}: ${e.text}`).join('\n')}
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
                  const effNetto = nachlass ? Math.round((netto - nachlass.betrag) * 100) / 100 : netto
                  const effMwst = nachlass ? Math.round((netto - nachlass.betrag) * 20) / 100 : mwst
                  const effBrutto = nachlass ? Math.round((netto - nachlass.betrag) * 120) / 100 : brutto
                  const betrifftClean = stripAdresseFromBetreff(betreff, lastAdresse)
                  const datum = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  return generateAngebotPdf({
                    betrifft: betrifftClean,
                    adresse: lastAdresse || '',
                    projektnummer,
                    gewerke: blocks,
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
                betreff={`Angebot ${projektnummer || ''} – ${stripAdresseFromBetreff(betreff, lastAdresse) || ''}`}
                projektnummer={projektnummer}
                adresse={lastAdresse || ''}
                betrifft={stripAdresseFromBetreff(betreff, lastAdresse) || ''}
                pdfFilename={`Angebot-${projektnummer || 'neu'}-${(stripAdresseFromBetreff(betreff, lastAdresse) || 'Angebot').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').replace(/_+/g, '_')}.pdf`}
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
