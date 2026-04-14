import { useNavigate } from 'react-router-dom'
import { Calculator, ArrowsLeftRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6">
      <p className="text-[13px] text-gray-400 mb-4">
        Hallo{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
      </p>

      <div className="space-y-2">
        <button
          onClick={() => navigate('/kalkulation')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 rounded-lg px-4 py-3.5 active:bg-gray-50 transition-colors text-left"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
            <Calculator size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-secondary">Kalkulation</p>
            <p className="text-[11px] text-gray-400">Angebote, Preisliste, Vorlagen</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/delegieren')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 rounded-lg px-4 py-3.5 active:bg-gray-50 transition-colors text-left"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="w-10 h-10 bg-secondary rounded-md flex items-center justify-center flex-shrink-0">
            <ArrowsLeftRight size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-secondary">Delegieren</p>
            <p className="text-[11px] text-gray-400">Nachrichten & Kontakte</p>
          </div>
        </button>
      </div>
    </div>
  )
}
