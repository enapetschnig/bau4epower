import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import Layout from './components/Layout/Layout.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Projekte from './pages/Projekte.jsx'
import ProjektDetail from './pages/ProjektDetail.jsx'
import ProjektDateien from './pages/ProjektDateien.jsx'
import ProjektMaterial from './pages/ProjektMaterial.jsx'
import Zeiterfassung from './pages/Zeiterfassung.jsx'
import Mitarbeiter from './pages/Mitarbeiter.jsx'
import MitarbeiterDokumente from './pages/MitarbeiterDokumente.jsx'
import MeineStunden from './pages/MeineStunden.jsx'
import MeineDokumente from './pages/MeineDokumente.jsx'
import Regiearbeiten from './pages/Regiearbeiten.jsx'
import RegiearbeitForm from './pages/RegiearbeitForm.jsx'
import Auswertung from './pages/Auswertung.jsx'
import PvAngeboteListe from './pages/PvAngeboteListe.jsx'
import PvAngebotNeu from './pages/PvAngebotNeu.jsx'
import PvMaterial from './pages/PvMaterial.jsx'
import Einstellungen from './pages/Einstellungen.jsx'
import AngebotView from './pages/Angebot.jsx'
import BesprechungHub from './pages/BesprechungHub.jsx'
import AufmassHub from './pages/AufmassHub.jsx'
import AufmassView from './pages/AufmassView.jsx'
import ProtokollView from './pages/ProtokollView.jsx'
import Kalkulation from './pages/Kalkulation/index.jsx'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-light">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-base font-extrabold">ET</span>
          </div>
          <p className="text-gray-400 text-[12px]">Laden...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />

        {/* Projekte */}
        <Route path="projekte" element={<Projekte />} />
        <Route path="projekte/:id" element={<ProjektDetail />} />
        <Route path="projekte/:id/dateien/:category" element={<ProjektDateien />} />
        <Route path="projekte/:id/material" element={<ProjektMaterial />} />

        {/* Zeiterfassung & Stunden */}
        <Route path="zeiterfassung" element={<Zeiterfassung />} />
        <Route path="meine-stunden" element={<MeineStunden />} />
        <Route path="meine-dokumente" element={<MeineDokumente />} />

        {/* Regiearbeiten */}
        <Route path="regiearbeiten" element={<Regiearbeiten />} />
        <Route path="regiearbeiten/neu" element={<RegiearbeitForm />} />
        <Route path="regiearbeiten/:id" element={<RegiearbeitForm />} />

        {/* Mitarbeiter (Admin) */}
        <Route path="mitarbeiter" element={<Mitarbeiter />} />
        <Route path="mitarbeiter/:employeeId/dokumente" element={<MitarbeiterDokumente />} />
        <Route path="auswertung" element={<Auswertung />} />

        {/* PV-Angebote */}
        <Route path="angebote" element={<PvAngeboteListe />} />
        <Route path="angebote/neu" element={<PvAngebotNeu />} />
        <Route path="angebote/neu/:id" element={<PvAngebotNeu />} />
        <Route path="angebote/material" element={<PvMaterial />} />

        <Route path="einstellungen" element={<Einstellungen />} />

        {/* Legacy routes (Kalkulations-System bleibt verfügbar) */}
        <Route path="kalkulation" element={<Kalkulation />} />
        <Route path="aufmass" element={<AufmassHub />} />
        <Route path="besprechung" element={<BesprechungHub />} />
        <Route path="angebot/:id" element={<AngebotView />} />
        <Route path="aufmass/:id" element={<AufmassView />} />
        <Route path="protokoll/:id" element={<ProtokollView />} />
        <Route path="vorlagen" element={<Navigate to="/kalkulation?modus=vorlagen" replace />} />
        <Route path="katalog" element={<Navigate to="/kalkulation?modus=preisliste" replace />} />
        <Route path="delegieren" element={<Navigate to="/" replace />} />
        <Route path="admin" element={<Navigate to="/einstellungen" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
