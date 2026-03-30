export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  const baseURL = useRuntimeConfig().app.baseURL || '/'
  const swUrl = `${baseURL.replace(/\/$/, '') || ''}/sw.js`

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.error('Service worker registration failed', error)
    })
  })
})
