import { useSearchParams } from 'react-router-dom'
import { PencilLine, ListBullets } from '@phosphor-icons/react'
import Aufmass from './Aufmass.jsx'
import Aufmaesse from './Aufmaesse.jsx'

const TABS = [
  { id: 'neu', label: 'Neues Aufmaß', Icon: PencilLine },
  { id: 'liste', label: 'Aufmaße', Icon: ListBullets },
]

export default function AufmassHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'neu'

  function setTab(id) {
    setSearchParams({ tab: id })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Tab-Auswahl */}
      <div className="card p-2">
        <div className="grid grid-cols-2 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all
                ${tab === t.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-100'
                }`}
            >
              <t.Icon size={22} weight={tab === t.id ? 'fill' : 'regular'} />
              <span className="text-xs font-medium leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab-Content */}
      {tab === 'neu' && <Aufmass embedded />}
      {tab === 'liste' && <Aufmaesse embedded />}
    </div>
  )
}
