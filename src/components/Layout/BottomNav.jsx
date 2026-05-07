import { NavLink } from 'react-router-dom'
import { House, Briefcase, Clock, FileText, UsersThree } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext.jsx'

export default function BottomNav() {
  const { isAdmin } = useAuth()

  const navItems = [
    { to: '/', label: 'Start', Icon: House, end: true },
    { to: '/projekte', label: 'Projekte', Icon: Briefcase },
    { to: '/zeiterfassung', label: 'Zeit', Icon: Clock },
    { to: '/angebote', label: 'Angebote', Icon: FileText },
    isAdmin
      ? { to: '/mitarbeiter', label: 'Team', Icon: UsersThree }
      : { to: '/meine-stunden', label: 'Stunden', Icon: Clock },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-6xl mx-auto flex">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center justify-center py-1.5 gap-px min-h-[50px] transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[9px] font-medium">{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
