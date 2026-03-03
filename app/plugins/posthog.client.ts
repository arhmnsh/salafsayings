import posthog from 'posthog-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const posthogClient = posthog

  if (config.public.posthogPublicKey) {
    posthogClient.init(config.public.posthogPublicKey, {
      api_host: config.public.posthogHost || 'https://us.i.posthog.com',
      capture_pageview: false,
      loaded: (ph) => {
        if (import.meta.dev) ph.debug()
      }
    })

    const router = useRouter()
    router.afterEach((to) => {
      nextTick(() => {
        posthog.capture('$pageview', {
          $current_url: to.fullPath
        })
      })
    })
  }

  return {
    provide: {
      posthog: () => posthogClient
    }
  }
})
