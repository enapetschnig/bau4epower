import { useSearchParams } from 'react-router-dom'
import Aufmass from './Aufmass.jsx'
import Aufmaesse from './Aufmaesse.jsx'

const TABS = [
  { id: 'neu', label: 'Neues Aufmaß' },
  { id: 'liste', label: 'Aufmaße' },
]

export default function AufmassHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'neu'

  return (
    <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
      <div className="flex gap-px bg-gray-100 rounded-md p-0.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSearchParams({ tab: t.id })}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[5px] transition-all
              ${tab === t.id
                ? 'bg-white text-secondary shadow-sm'
                : 'text-gray-400'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'neu' && <Aufmass embedded />}
      {tab === 'liste' && <Aufmaesse embedded />}
    </div>
  )
}
