import fs from 'node:fs'
import path from 'node:path'

const sayingsPath = path.resolve(process.cwd(), 'content/salafsayings.json')
const sayings = JSON.parse(fs.readFileSync(sayingsPath, 'utf8')) as Array<{ id?: string; slug?: string }>
const sayingRoutes = sayings
  .map((item) => String(item.id || item.slug || '').trim())
  .filter(Boolean)
  .map((id) => `/${encodeURIComponent(id)}`)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  srcDir: 'app',
  modules: ['@nuxt/content', '@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    classSuffix: ''
  },
  app: {
    head: {
      title: 'Salaf Sayings',
      meta: [
        { name: 'application-name', content: 'Salaf Sayings' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Salaf Sayings' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#0d1731' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap' }
      ]
    }
  },
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {}
    }
  },
  runtimeConfig: {
    public: {
      posthogPublicKey: '',
      posthogHost: '',
      analyticsSite: 'salafsayings',
      analyticsDomain: 'salafsayings.arhmn.sh'
    }
  },
  nitro: {
    prerender: {
      routes: ['/', ...sayingRoutes]
    }
  }
})
