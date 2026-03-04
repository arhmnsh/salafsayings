import sayings from '../../../content/salafsayings.json'
import { renderAppOgSvg, renderQuoteOgSvg } from '../../utils/og'

type Saying = {
  id: string
  slug: string
  title: string
  quote: string
  intro?: string
  author?: string
}

const allSayings = sayings as Saying[]

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const host = config.public.analyticsDomain || 'salafsayings.arhmn.sh'
  const siteUrl = `https://${host}`
  const routeId = getRouterParam(event, 'id') || ''

  const saying = allSayings.find(item => item.id === routeId || item.slug === routeId)
  const svg = saying ? renderQuoteOgSvg(saying, siteUrl) : renderAppOgSvg(siteUrl)

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800')
  return svg
})
