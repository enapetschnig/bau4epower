import { useSearchParams, Link } from 'react-router-dom'
import { Gear, Microphone, FileText, BookmarkSimple, BookBookmark, Files, Notepad } from '@phosphor-icons/react'
import { useSettings } from '../../hooks/useSettings.js'
import VariablePosition from './VariablePosition.jsx'
import KleinesAngebot from './KleinesAngebot.jsx'
import GrossesAngebot from './GrossesAngebot.jsx'
import Angebote from '../Angebote.jsx'
import Vorlagen from '../Vorlagen.jsx'
import Katalog from '../Katalog.jsx'

const MODES = [
  { id: '1', label: 'Leistung NEU', Icon: Microphone },
  { id: '2', label: 'Kleines Angebot', Icon: FileText },
  { id: '3', label: 'Großes Angebot', Icon: Notepad },
]

const SUB_PAGES = [
  { id: 'angebote', label: 'Angebote', Icon: Files },
  { id: 'vorlagen', label: 'Vorlagen', Icon: BookmarkSimple },
  { id: 'preisliste', label: 'Preisliste', Icon: BookBookmark },
]

export default function Kalkulation() {
  const [searchParams, setSearchParams] = useSearchParams()
  const modus = searchParams.get('modus') || '1'
  const offerId = searchParams.get('offerId') || null
  const { settings, loading: settingsLoading } = useSettings()

  const isSubPage = SUB_PAGES.some(p => p.id === modus)

  function setModus(id) {
    setSearchParams({ modus: id })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Read-only Aufschlag-Info – only for calculation modes */}
      {!settingsLoading && !isSubPage && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
          <Gear size={13} weight="fill" className="text-gray-400 flex-shrink-0" />
          <span className="flex-1">
            Aufschlag Gesamt: <strong className="text-secondary">{settings.aufschlag_gesamt_prozent}%</strong>
            {' | '}
            Aufschlag Material: <strong className="text-secondary">{settings.aufschlag_material_prozent}%</strong>
            <span className="text-gray-400"> – nur für neu kalkulierte Positionen</span>
          </span>
          <Link to="/einstellungen" className="text-primary text-xs flex-shrink-0 font-medium">
            Ändern
          </Link>
        </div>
      )}

      {/* Mode Selector – Kalkulation modes */}
      <div className="card p-2">
        <div className="grid grid-cols-3 gap-1">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setModus(mode.id)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
                ${modus === mode.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-100'
                }`}
            >
              <mode.Icon size={22} weight={modus === mode.id ? 'fill' : 'regular'} />
              <span className="text-xs font-medium leading-tight text-center">{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-page tabs (Angebote, Vorlagen, Katalog) */}
        <div className="grid grid-cols-3 gap-1 mt-1 pt-1 border-t border-gray-100">
          {SUB_PAGES.map(page => (
            <button
              key={page.id}
              onClick={() => setModus(page.id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl transition-all
                ${modus === page.id
                  ? 'bg-secondary text-white shadow-sm'
                  : 'text-gray-400 active:bg-gray-100'
                }`}
            >
              <page.Icon size={20} weight={modus === page.id ? 'fill' : 'regular'} />
              <span className="text-[11px] font-medium leading-tight text-center">{page.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Content */}
      {modus === '1' && <VariablePosition />}
      {modus === '2' && <KleinesAngebot loadOfferId={offerId} />}
      {modus === '3' && <GrossesAngebot />}
      {modus === 'angebote' && <Angebote embedded />}
      {modus === 'vorlagen' && <Vorlagen embedded />}
      {modus === 'preisliste' && <Katalog embedded />}
    </div>
  )
}
