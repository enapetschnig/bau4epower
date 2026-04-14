import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import BottomNav from './BottomNav.jsx'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-light">
      <Navbar />
      <main className="flex-1" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
