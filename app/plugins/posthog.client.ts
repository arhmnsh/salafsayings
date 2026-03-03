import posthog from 'posthog-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const posthogClient = posthog

  if (config.public.posthogPublicKey) {
    const site = config.public.analyticsSite || 'salafsayings'
    const siteDomain = config.public.analyticsDomain || 'salafsayings.arhmn.sh'

    posthogClient.init(config.public.posthogPublicKey, {
      api_host: config.public.posthogHost || 'https://us.i.posthog.com',
      capture_pageview: false,
      loaded: (ph) => {
        if (import.meta.dev) ph.debug()
      }
    })

    posthogClient.register({
      site,
      site_domain: siteDomain
    })

    const capturePageview = (path: string) => {
      nextTick(() => {
        posthogClient.capture('$pageview', {
          $current_url: path,
          site,
          site_domain: siteDomain
        })
      })
    }

    const router = useRouter()
    capturePageview(router.currentRoute.value.fullPath)
    router.afterEach((to) => {
      capturePageview(to.fullPath)
    })
  }

  return {
    provide: {
      posthog: () => posthogClient
    }
  }
})
