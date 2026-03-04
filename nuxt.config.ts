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
      link: [
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
