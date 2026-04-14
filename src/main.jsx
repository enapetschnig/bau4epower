import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// PWA Service Worker: auto-update + sofort aktivieren
// Löst das iOS-Cache-Problem: neue Versionen werden sofort geladen
const updateSW = registerSW({
  onNeedRefresh() {
    // Neue Version verfügbar → sofort aktualisieren (kein Prompt)
    console.log('[PWA] Neue Version verfügbar – aktualisiere...')
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[PWA] App ist offline-fähig')
  },
  onRegisteredSW(swUrl, registration) {
    // Alle 60 Sekunden auf Updates prüfen (wichtig für iOS)
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 1000)
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
