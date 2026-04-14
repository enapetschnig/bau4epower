import { useSearchParams, Link } from 'react-router-dom'
import { Gear } from '@phosphor-icons/react'
import { useSettings } from '../../hooks/useSettings.js'
import VariablePosition from './VariablePosition.jsx'
import KleinesAngebot from './KleinesAngebot.jsx'
import GrossesAngebot from './GrossesAngebot.jsx'
import Angebote from '../Angebote.jsx'
import Vorlagen from '../Vorlagen.jsx'
import Katalog from '../Katalog.jsx'

const MODES = [
  { id: '1', label: 'Leistung' },
  { id: '2', label: 'Klein' },
  { id: '3', label: 'Groß' },
]

const SUB_PAGES = [
  { id: 'angebote', label: 'Angebote' },
  { id: 'vorlagen', label: 'Vorlagen' },
  { id: 'preisliste', label: 'Preisliste' },
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
    <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
      {/* Aufschlag-Info */}
      {!settingsLoading && !isSubPage && (
        <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
          <Gear size={11} weight="fill" className="text-gray-300 flex-shrink-0" />
          <span>
            Aufschlag <strong className="text-secondary">{settings.aufschlag_gesamt_prozent}%</strong>
            {' · '}
            Material <strong className="text-secondary">{settings.aufschlag_material_prozent}%</strong>
          </span>
          <Link to="/einstellungen" className="text-secondary font-medium ml-auto">Ändern</Link>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
        {MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => setModus(mode.id)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
              ${modus === mode.id
                ? 'bg-white text-secondary shadow-sm'
                : 'text-gray-400'
              }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
        {SUB_PAGES.map(page => (
          <button
            key={page.id}
            onClick={() => setModus(page.id)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
              ${modus === page.id
                ? 'bg-white text-secondary shadow-sm'
                : 'text-gray-400'
              }`}
          >
            {page.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {modus === '1' && <VariablePosition />}
      {modus === '2' && <KleinesAngebot loadOfferId={offerId} />}
      {modus === '3' && <GrossesAngebot />}
      {modus === 'angebote' && <Angebote embedded />}
      {modus === 'vorlagen' && <Vorlagen embedded />}
      {modus === 'preisliste' && <Katalog embedded />}
    </div>
  )
}
