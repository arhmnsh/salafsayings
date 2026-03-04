import { renderAppOgSvg } from '../../utils/og'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const host = config.public.analyticsDomain || 'salafsayings.arhmn.sh'
  const siteUrl = `https://${host}`
  const svg = renderAppOgSvg(siteUrl)

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800')
  return svg
})
