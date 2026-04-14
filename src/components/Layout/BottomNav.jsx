import { NavLink } from 'react-router-dom'
import { Calculator, ClipboardText, GearSix, Ruler, ArrowsLeftRight } from '@phosphor-icons/react'

const navItems = [
  { to: '/kalkulation', label: 'Kalkulation', Icon: Calculator },
  { to: '/aufmass', label: 'Aufmaß', Icon: Ruler },
  { to: '/delegieren', label: 'Delegieren', Icon: ArrowsLeftRight },
  { to: '/besprechung', label: 'Besprechung', Icon: ClipboardText },
  { to: '/einstellungen', label: 'Mehr', Icon: GearSix },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-2xl mx-auto flex">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center justify-center py-1.5 gap-px min-h-[46px] transition-colors ${isActive ? 'text-secondary' : 'text-gray-300'}`}>
                <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[9px] font-medium">{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
