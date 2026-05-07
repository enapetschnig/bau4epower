import { Link } from 'react-router-dom'
import { useState } from 'react'
import { CaretDown, SignOut, User, House, DownloadSimple, Lock } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import Logo from '../Logo.jsx'

export default function Navbar() {
  const { profile, fullName, isAdmin, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  const displayName = fullName || profile?.email || ''
  const firstName = displayName.split(' ')[0] || ''

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 11) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <Logo size="md" />
            <div className="hidden sm:block min-w-0">
              <p className="text-[10px] text-gray-400 leading-tight">{greeting}</p>
              <p className="text-[12px] font-semibold text-secondary leading-tight truncate">
                {firstName || 'Willkommen'}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                aria-label="Menü"
              >
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-[12px] font-bold">
                  {(firstName || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-medium text-secondary hidden md:block max-w-[120px] truncate">
                  Menü
                </span>
                <CaretDown size={11} className="text-gray-400 hidden md:block" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-100 rounded-lg shadow-lg z-40 py-1">
                    <div className="px-3 py-2 border-b border-gray-50">
                      <p className="text-[12px] font-semibold text-secondary truncate">{displayName}</p>
                      <p className="text-[10px] text-gray-400">{isAdmin ? 'Administrator' : 'Mitarbeiter'}</p>
                    </div>
                    <Link
                      to="/"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50"
                    >
                      <House size={14} />
                      Startseite
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); setShowInstall(true) }}
                      className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50 w-full text-left"
                    >
                      <DownloadSimple size={14} />
                      Auf Handy installieren
                    </button>
                    <Link
                      to="/einstellungen"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50"
                    >
                      <Lock size={14} />
                      Passwort ändern
                    </Link>
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
                      className="flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-gray-50 w-full text-left border-t border-gray-50 mt-1 pt-2"
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

      {showInstall && <InstallPromptDialog onClose={() => setShowInstall(false)} />}
    </>
  )
}

function InstallPromptDialog({ onClose }) {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  const isAndroid = /Android/i.test(ua)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary flex items-center gap-2">
            <DownloadSimple size={18} weight="fill" className="text-primary" />
            App auf Handy installieren
          </h2>
        </div>
        <p className="text-[12px] text-gray-500 mb-4">
          Installiere die ET KÖNIG App auf deinem Smartphone für schnelleren Zugriff – ohne App-Store.
        </p>

        {isIOS ? (
          <div className="space-y-3 text-[12px]">
            <div className="bg-primary-50 rounded-lg p-3">
              <p className="font-semibold text-secondary mb-2">📱 Auf iPhone / iPad (Safari):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>Tippe unten auf das <strong>Teilen-Symbol</strong> (Quadrat mit Pfeil nach oben)</li>
                <li>Scrolle nach unten und wähle <strong>"Zum Home-Bildschirm"</strong></li>
                <li>Tippe oben rechts auf <strong>"Hinzufügen"</strong></li>
              </ol>
            </div>
          </div>
        ) : isAndroid ? (
          <div className="space-y-3 text-[12px]">
            <div className="bg-primary-50 rounded-lg p-3">
              <p className="font-semibold text-secondary mb-2">📱 Auf Android (Chrome):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>Tippe oben rechts auf das <strong>Drei-Punkte-Menü</strong></li>
                <li>Wähle <strong>"App installieren"</strong> oder <strong>"Zum Startbildschirm hinzufügen"</strong></li>
                <li>Bestätige mit <strong>"Installieren"</strong></li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-[12px]">
            <div className="bg-primary-50 rounded-lg p-3">
              <p className="font-semibold text-secondary mb-2">💻 Im Browser (Desktop):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                <li>Suche das <strong>Installations-Symbol</strong> in der Adressleiste</li>
                <li>Oder wähle im Browser-Menü <strong>"App installieren"</strong></li>
              </ol>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-secondary mb-1">📲 Auf dem Handy:</p>
              <p className="text-gray-600">Öffne diese Seite im Handy-Browser, dann zeigt dir die App die genaue Anleitung.</p>
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-primary w-full mt-4">
          Verstanden
        </button>
      </div>
    </div>
  )
}
