import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import Logo from '../Logo.jsx'

export default function Navbar() {
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 hidden sm:block">{profile?.name || profile?.email}</span>
          <button
            onClick={signOut}
            className="text-[11px] text-gray-400 hover:text-secondary transition-colors px-2 py-1"
          >
            Abmelden
          </button>
        </div>
      </div>
    </header>
  )
}
