import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import Layout from './components/Layout/Layout.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Projekte from './pages/Projekte.jsx'
import Zeiterfassung from './pages/Zeiterfassung.jsx'
import Mitarbeiter from './pages/Mitarbeiter.jsx'
import MeineStunden from './pages/MeineStunden.jsx'
import Regiearbeiten from './pages/Regiearbeiten.jsx'
import Auswertung from './pages/Auswertung.jsx'
import Kalkulation from './pages/Kalkulation/index.jsx'
import Einstellungen from './pages/Einstellungen.jsx'
import AngebotView from './pages/Angebot.jsx'
import BesprechungHub from './pages/BesprechungHub.jsx'
import AufmassHub from './pages/AufmassHub.jsx'
import AufmassView from './pages/AufmassView.jsx'
import ProtokollView from './pages/ProtokollView.jsx'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-light">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white text-base font-extrabold">ET</span>
          </div>
          <p className="text-gray-400 text-sm">Laden...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="projekte" element={<Projekte />} />
        <Route path="zeiterfassung" element={<Zeiterfassung />} />
        <Route path="meine-stunden" element={<MeineStunden />} />
        <Route path="regiearbeiten" element={<Regiearbeiten />} />
        <Route path="mitarbeiter" element={<Mitarbeiter />} />
        <Route path="auswertung" element={<Auswertung />} />
        <Route path="angebote" element={<Kalkulation />} />
        <Route path="einstellungen" element={<Einstellungen />} />

        {/* Legacy / Detail Routes – Kalkulation & Co bleiben verfügbar */}
        <Route path="kalkulation" element={<Kalkulation />} />
        <Route path="aufmass" element={<AufmassHub />} />
        <Route path="besprechung" element={<BesprechungHub />} />
        <Route path="angebot/:id" element={<AngebotView />} />
        <Route path="aufmass/:id" element={<AufmassView />} />
        <Route path="protokoll/:id" element={<ProtokollView />} />
        <Route path="vorlagen" element={<Navigate to="/angebote?modus=vorlagen" replace />} />
        <Route path="katalog" element={<Navigate to="/angebote?modus=preisliste" replace />} />
        <Route path="delegieren" element={<Navigate to="/" replace />} />
        <Route path="admin" element={<Navigate to="/einstellungen" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}
