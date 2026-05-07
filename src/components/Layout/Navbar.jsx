import { Link } from 'react-router-dom'
import { useState } from 'react'
import { CaretDown, SignOut, Bell, User } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import Logo from '../Logo.jsx'

export default function Navbar() {
  const { profile, fullName, isAdmin, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const displayName = fullName || profile?.email || 'Mitarbeiter'

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-1">
          <button className="touch-btn text-gray-400 hover:text-secondary transition-colors">
            <Bell size={18} weight="regular" />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-[11px] font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-secondary hidden sm:block max-w-[120px] truncate">
                {displayName}
              </span>
              <CaretDown size={11} className="text-gray-400" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-lg shadow-lg z-40 py-1">
                  <div className="px-3 py-2 border-b border-gray-50">
                    <p className="text-[12px] font-semibold text-secondary truncate">{displayName}</p>
                    <p className="text-[10px] text-gray-400">{isAdmin ? 'Administrator' : 'Mitarbeiter'}</p>
                  </div>
                  <Link
                    to="/einstellungen"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50"
                  >
                    <User size={14} />
                    Profil & Einstellungen
                  </Link>
                  <button
                    onClick={() => { setMenuOpen(false); signOut() }}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50 w-full text-left"
                  >
                    <SignOut size={14} />
                    Abmelden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
