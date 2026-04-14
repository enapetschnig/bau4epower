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
        name: 'NAPETSCHNIG. Angebots-App',
        short_name: 'NAPETSCHNIG.',
        description: 'KI-gestützte Angebotserstellung für NAPETSCHNIG.',
        theme_color: '#3a3a3a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
