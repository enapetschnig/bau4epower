import { useNavigate } from 'react-router-dom'
import { Calculator, ArrowsLeftRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <div className="flex flex-col px-5 pt-5"
      style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-secondary">
          Hallo{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Was möchten Sie tun?</p>
      </div>

      {/* 2 Buttons nebeneinander */}
      <div className="grid grid-cols-2 gap-3">

        {/* Delegieren */}
        <button
          onClick={() => navigate('/delegieren')}
          className="bg-secondary text-white rounded-2xl active:scale-[0.97] transition-transform overflow-hidden flex flex-col"
          style={{ boxShadow: '0 4px 20px 0 rgba(26,26,26,0.15)' }}
        >
          <div className="flex flex-col items-center justify-center gap-2 flex-1 px-3 py-5">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <ArrowsLeftRight size={24} weight="fill" className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold tracking-tight">Delegieren</p>
              <p className="text-[10px] text-white/60 mt-0.5">Nachrichten & Kontakte</p>
            </div>
          </div>
        </button>

        {/* Kalkulation */}
        <button
          onClick={() => navigate('/kalkulation')}
          className="bg-primary text-white rounded-2xl active:scale-[0.97] transition-transform overflow-hidden flex flex-col"
          style={{ boxShadow: '0 4px 20px 0 rgba(58,58,58,0.20)' }}
        >
          <div className="flex flex-col items-center justify-center gap-2 flex-1 px-3 py-5">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Calculator size={24} weight="fill" className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold tracking-tight">Kalkulation</p>
              <p className="text-[10px] text-white/60 mt-0.5">Angebote & Preisliste</p>
            </div>
          </div>
        </button>

      </div>
    </div>
  )
}
