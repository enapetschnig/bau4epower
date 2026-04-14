import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import Layout from './components/Layout/Layout.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Kalkulation from './pages/Kalkulation/index.jsx'
import Delegieren from './pages/Delegieren/index.jsx'
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
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-extrabold" style={{ fontFamily: 'Georgia, serif' }}>N.</span>
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
        {/* Home: 2-Button Landing */}
        <Route index element={<Home />} />
        <Route path="kalkulation" element={<Kalkulation />} />
        <Route path="delegieren" element={<Delegieren />} />
        <Route path="aufmass" element={<AufmassHub />} />
        <Route path="besprechung" element={<BesprechungHub />} />
        <Route path="einstellungen" element={<Einstellungen />} />
        {/* Detail views */}
        <Route path="angebot/:id" element={<AngebotView />} />
        <Route path="aufmass/:id" element={<AufmassView />} />
        <Route path="protokoll/:id" element={<ProtokollView />} />
        {/* Legacy redirects */}
        <Route path="angebote" element={<Navigate to="/kalkulation?modus=angebote" replace />} />
        <Route path="vorlagen" element={<Navigate to="/kalkulation?modus=vorlagen" replace />} />
        <Route path="katalog" element={<Navigate to="/kalkulation?modus=preisliste" replace />} />
        <Route path="protokoll" element={<Navigate to="/besprechung" replace />} />
        <Route path="protokolle" element={<Navigate to="/besprechung?tab=liste" replace />} />
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
