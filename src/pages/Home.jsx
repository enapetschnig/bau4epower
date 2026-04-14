import { useNavigate } from 'react-router-dom'
import { Calculator, ArrowsLeftRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  return (
    <div className="flex flex-col px-5 pt-6"
      style={{ minHeight: 'calc(100vh - 144px)' }}>

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">
          Guten Tag{profile?.name ? `, ${profile.name}` : ''}!
        </h1>
        <p className="text-sm text-gray-400 mt-1">Wählen Sie Ihren Bereich</p>
      </div>

      {/* 2 Buttons nebeneinander */}
      <div className="grid grid-cols-2 gap-4">

        {/* Delegieren – Links */}
        <button
          onClick={() => navigate('/delegieren')}
          className="bg-secondary text-white rounded-3xl shadow-lg active:scale-95 transition-transform overflow-hidden flex flex-col"
          style={{ boxShadow: '0 8px 32px 0 rgba(44,62,80,0.20)', minHeight: '200px' }}
        >
          <div className="flex flex-col items-center justify-center gap-3 flex-1 px-4 py-6">
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
              <ArrowsLeftRight size={32} weight="fill" className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold tracking-tight">Delegieren</p>
              <p className="text-xs text-blue-100 mt-1 leading-snug">
                Nachrichten &amp; Kontakte
              </p>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 px-3 py-2 text-center">
            <span className="text-[10px] text-blue-100">KI Mails &amp; KI WhatsApp</span>
          </div>
        </button>

        {/* Kalkulation – Rechts */}
        <button
          onClick={() => navigate('/kalkulation')}
          className="bg-primary text-white rounded-3xl shadow-lg active:scale-95 transition-transform overflow-hidden flex flex-col"
          style={{ boxShadow: '0 8px 32px 0 rgba(192,57,43,0.25)', minHeight: '200px' }}
        >
          <div className="flex flex-col items-center justify-center gap-3 flex-1 px-4 py-6">
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
              <Calculator size={32} weight="fill" className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold tracking-tight">Kalkulation</p>
              <p className="text-xs text-red-100 mt-1 leading-snug">
                Angebote &amp; Preisliste
              </p>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 px-3 py-2 text-center">
            <span className="text-[10px] text-red-100">Angebote · Vorlagen · Katalog</span>
          </div>
        </button>

      </div>
    </div>
  )
}
