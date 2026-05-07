import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Cache alle App-Assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Navigation immer zur index.html (SPA)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//, /^\/api\//],
        // Keine Runtime-Caching für API-Calls (immer frisch)
        runtimeCaching: [
          {
            urlPattern: /\/functions\/v1\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'ET KÖNIG GmbH – Mitarbeiter-App',
        short_name: 'ET KÖNIG',
        description: 'Mitarbeiter-App für Projekte, Zeiterfassung und Angebote',
        theme_color: '#f68714',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      }
    })
  ]
})
