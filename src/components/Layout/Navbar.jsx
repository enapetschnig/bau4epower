import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import Logo from '../Logo.jsx'

export default function Navbar() {
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-24 flex items-center justify-between">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{profile?.name || profile?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-gray-400 active:text-primary transition-colors px-3 py-2 rounded-lg"
          >
            Abmelden
          </button>
        </div>
      </div>
    </header>
  )
}
