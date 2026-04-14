import { useState, useRef } from 'react'
import { SpinnerGap, Microphone } from '@phosphor-icons/react'

const GEWERK_PREFIX = {
  'Gemeinkosten': '01', 'Abbruch': '02', 'Bautischler': '03', 'Glaser': '04',
  'Elektriker': '05', 'Installateur': '06', 'Baumeister': '07', 'Trockenbau': '08',
  'Maler': '09', 'Anstreicher': '10', 'Fliesenleger': '11', 'Bodenleger': '12',
  'Reinigung': '13', 'Elektrozuleitung': '16',
}

import SpeechInput from '../../components/SpeechInput.jsx'
import PositionCard from '../../components/PositionCard.jsx'
import { callClaude, callClaudeWithSearch, parseJsonResponse, cleanWebSearchTags, fixPositionKosten, stripVorschlag, enrichFromCatalog, ensureRegieMaterial, applyRegieMaterial, injectZimmerbezeichnungen, fixNullpreise, verifyAufschlaege } from '../../lib/claude.js'
import { DEFAULT_PROMPT_1, DEFAULT_PROMPT_EDIT, buildPrompt } from '../../lib/prompts.js'
import { useToast } from '../../contexts/ToastContext.jsx'
import { useCatalog } from '../../hooks/useCatalog.js'
import { usePrompts } from '../../hooks/usePrompts.js'
import { useSettings } from '../../hooks/useSettings.js'
import { formatSpracheingabe } from '../../utils/textFormat.js'

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

export default function VariablePosition() {
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [lastInput, setLastInput] = useState('')
  const [parseError, setParseError] = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const resultRef = useRef(null)
  const editRef = useRef(null)
  const { showToast } = useToast()
  const { catalog, stundensaetze } = useCatalog()
  const { prompt1 } = usePrompts()
  const { settings } = useSettings()

  function onRetry(s) {
    setRateLimitMsg(s > 0
      ? `Die KI ist gerade ausgelastet. Bitte warte einen Moment. (${s}s)`
      : '')
  }

  async function handleSpeechResult(text) {
    setLastInput(text)
    setParseError(false)
    setLoading(true)
    try {
      const basePrompt = DEFAULT_PROMPT_1 || prompt1
      console.log('PROMPT QUELLE:', DEFAULT_PROMPT_1 ? 'CODE DEFAULT' : 'SUPABASE')
      const systemPrompt = buildPrompt(basePrompt, stundensaetze, settings)
      console.log('PROMPT SIZE:', systemPrompt.length, 'chars', (systemPrompt.length / 1024).toFixed(1) + ' kB')
      console.log('PROMPT SIZE NACH KÜRZUNG:', systemPrompt.length)
      console.log('WEB SEARCH aktiviert für Modus: Leistung NEU')
      const response = await callClaudeWithSearch(systemPrompt, `BESCHREIBUNG: ${text}`, onRetry, 2000)
      let parsed = parseJsonResponse(response)
      if (parsed && !Array.isArray(parsed)) {
        parsed.leistungsname = cleanWebSearchTags(parsed.leistungsname)
        parsed.beschreibung = cleanWebSearchTags(parsed.beschreibung)
      }

      // Wenn Claude trotz Einzelpositions-Prompt ein Array zurückgibt → erste Position nehmen
      if (Array.isArray(parsed)) {
        console.warn('[VariablePosition] KI hat Array zurückgegeben, nehme erste Position:', parsed)
        parsed = parsed[0]
      }

      let data = stripVorschlag(fixPositionKosten(parsed))
      console.log('[VariablePosition] fixPositionKosten+stripVorschlag →', data)

      const prefix = GEWERK_PREFIX[data.gewerk] || null
      if (!prefix) {
        console.warn('[VariablePosition] Gewerk nicht erkannt:', data.gewerk, '→ setze NEU-NEU')
      }
      data.leistungsnummer = prefix ? `${prefix}-NEU` : 'NEU-NEU'

      // Wrap in gewerke array for inject/fix functions, then unwrap
      let fakeGewerke = [{ name: data.gewerk || 'Allgemein', positionen: [data] }]
      fakeGewerke = enrichFromCatalog(fakeGewerke, catalog, stundensaetze)
      fakeGewerke = ensureRegieMaterial(fakeGewerke, catalog)
      fakeGewerke = applyRegieMaterial(fakeGewerke, catalog)
      const [fixedGewerk] = fixNullpreise(
        injectZimmerbezeichnungen(fakeGewerke, text),
        catalog, stundensaetze
      )
      data = fixedGewerk?.positionen?.[0] || data
      data = verifyAufschlaege(data, settings)

      // Plausibilitätsprüfung: NEU-Positionen mit mehreren Arbeitsschritten sollten nicht unter 100€ liegen
      if (data.leistungsnummer?.includes('NEU')) {
        const beschreibungText = (data.beschreibung || '') + ' ' + (data.leistungsname || '')
        const arbeitsschrittKeywords = [
          'demontier', 'montier', 'entfern', 'verlegen', 'verleg', 'abbruch', 'abreis',
          'schleifen', 'grundier', 'streichen', 'spachtel', 'verfug', 'abdicht',
          'verspachtel', 'ausmalen', 'verputz', 'dämm', 'isolier', 'abdeck',
        ]
        const gefundeneSchritte = arbeitsschrittKeywords.filter(k =>
          beschreibungText.toLowerCase().includes(k)
        )
        if (gefundeneSchritte.length >= 2 && (data.vk_netto_einheit || 0) < 100) {
          console.warn(
            '[PREIS-WARNUNG] NEU-Position hat', gefundeneSchritte.length, 'Arbeitsschritte',
            'aber nur', data.vk_netto_einheit, '€/Einheit – möglicherweise zu günstig kalkuliert.',
            'Schritte:', gefundeneSchritte.join(', ')
          )
        }
      }

      setPosition(data)
      setEditing(false)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } catch (err) {
      console.error('[VariablePosition] Fehler:', err)
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

  async function handleEditResult(text) {
    setEditLoading(true)
    setEditing(false)
    try {
      const { previousState: _ps, _rev: _rv, ...positionForApi } = position
      const systemPrompt = DEFAULT_PROMPT_EDIT
      const userMessage = `AKTUELLE POSITION:\n${JSON.stringify(positionForApi, null, 2)}\n\nÄNDERUNGSANWEISUNG: ${text}`
      console.log('EDIT MODE - systemPrompt Anfang:', systemPrompt.substring(0, 100))
      console.log('EDIT MODE - userMessage Anfang:', userMessage.substring(0, 100))
      const response = await callClaude(systemPrompt, userMessage, onRetry, 4000)
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
        // Leistungsnummer immer beibehalten
        updated.leistungsnummer = positionForApi.leistungsnummer
      }
      setPosition(updated)
      showToast('Position aktualisiert')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setEditLoading(false)
      setRateLimitMsg('')
    }
  }

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

  return (
    <div className="space-y-4">
      <SpeechInput
        onResult={handleSpeechResult}
        onError={msg => showToast(msg, 'error')}
        placeholder="z.B. 'Trockenbau Gipskartonwand, doppelt beplankt, 15cm stark, 25 Quadratmeter'"
        enableBullets={false}
        formatTranscript={formatSpracheingabe}
      />

      {rateLimitMsg && (
        <div className="card bg-orange-50 border border-orange-300 text-orange-700 text-sm text-center py-3 px-4">
          {rateLimitMsg}
        </div>
      )}
      {parseError && !loading && (
        <div className="card border border-orange-200 bg-orange-50 text-center space-y-3 py-6">
          <p className="font-medium text-orange-700">Die Position konnte nicht kalkuliert werden.</p>
          <p className="text-sm text-orange-600">Bitte versuche es erneut.</p>
          <button
            onClick={() => handleSpeechResult(lastInput)}
            className="btn-primary"
          >
            Erneut versuchen
          </button>
        </div>
      )}
      {loading && <Spinner label="KI kalkuliert..." />}

      {position && !loading && (
        <div ref={resultRef} className="space-y-3">
          <h2 className="section-title">Ergebnis</h2>
          <PositionCard position={position} />

          {editLoading && <Spinner label="KI aktualisiert Position..." />}

          {!editLoading && !editing && (
            <button
              onClick={() => {
                setEditing(true)
                setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
              }}
              className="btn-secondary w-full gap-2"
            >
              <Microphone size={20} weight="regular" />
              Position nachbearbeiten
            </button>
          )}

          {editing && !editLoading && (
            <div ref={editRef} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-secondary text-sm">Änderung sprechen</h3>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-400 active:text-gray-600 px-2 py-1"
                >
                  Abbrechen
                </button>
              </div>
              <SpeechInput
                onResult={handleEditResult}
                onError={msg => showToast(msg, 'error')}
                placeholder='z.B. "Preis auf 15 Euro" oder "Menge soll 25 sein" oder "Langtext: ..."'
                submitLabel="Ändern"
                autoStart
                enableBullets={false}
                formatTranscript={formatSpracheingabe}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
