import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const BASE_URL = 'https://www.sayingsofthesalaf.net'
const OUTPUT_FILE = resolve(process.cwd(), 'content/salafsayings.json')
const USER_AGENT = 'arhmnsh-salafsayings-bot/1.0 (+https://arhmn.sh)'

const argv = new Set(process.argv.slice(2))
const isIncremental = argv.has('--incremental')
const maxPagesArg = process.argv.find(a => a.startsWith('--max-pages='))
const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : 200

if (Number.isNaN(maxPages) || maxPages < 1) {
  throw new Error('Invalid --max-pages value')
}

const decodeHtml = (text) =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (html) =>
  decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )

const normalize = (text) => stripTags(text || '')

const delay = (ms) => new Promise(resolveDelay => setTimeout(resolveDelay, ms))

const loadExisting = async () => {
  try {
    const raw = await readFile(OUTPUT_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

const parsePost = (post, now) => {
  const content = post?.content?.rendered || ''
  const narrationBlockquoteMatch = content.match(
    /<blockquote[^>]*class="[^"]*narration[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i
  )
  const anyBlockquoteMatch = content.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)

  const firstParagraphMatch = content.match(/<p>([\s\S]*?)<\/p>/i)
  const sourceMatch = content.match(/<cite>([\s\S]*?)<\/cite>/i)
  const paragraphMatches = [...content.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => normalize(m[1]))
    .filter(Boolean)

  const embeddedTerms = Array.isArray(post?._embedded?.['wp:term'])
    ? post._embedded['wp:term'].flat()
    : []
  const categories = embeddedTerms
    .filter(term => term?.taxonomy === 'category')
    .map(term => normalize(term.name))
  const tags = embeddedTerms
    .filter(term => term?.taxonomy === 'post_tag')
    .map(term => normalize(term.name))

  const blockquoteText = narrationBlockquoteMatch
    ? normalize(narrationBlockquoteMatch[1])
    : anyBlockquoteMatch
      ? normalize(anyBlockquoteMatch[1])
      : ''

  const nonSourceParagraphs = paragraphMatches.filter((text) => {
    const source = sourceMatch ? normalize(sourceMatch[1]) : ''
    return source ? text !== source : true
  })

  const fallbackQuote = nonSourceParagraphs
    .slice(1)
    .sort((a, b) => b.length - a.length)[0] || nonSourceParagraphs[0] || ''

  const quote = blockquoteText || fallbackQuote
  if (!quote) return null

  return {
    id: String(post.id),
    slug: post.slug || '',
    title: normalize(post?.title?.rendered || ''),
    url: post.link,
    quote,
    intro: firstParagraphMatch ? normalize(firstParagraphMatch[1]) : undefined,
    source: sourceMatch ? normalize(sourceMatch[1]) : undefined,
    author: tags[0] || undefined,
    topics: categories.filter(Boolean),
    fetchedAt: now
  }
}

const fetchPostsPage = async (page) => {
  const endpoint = `${BASE_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed`
  const res = await fetch(endpoint, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) return { posts: [], totalPages: 0, status: res.status }
  const totalPages = Number(res.headers.get('x-wp-totalpages') || '0')
  const posts = await res.json()
  return { posts, totalPages, status: res.status }
}

const run = async () => {
  const now = new Date().toISOString()
  const existing = await loadExisting()
  const existingByUrl = new Map(existing.map(item => [item.url, item]))
  const collectedByUrl = new Map()

  let totalPages = 1
  const pageLimit = Math.min(maxPages, 200)

  for (let page = 1; page <= pageLimit; page += 1) {
    const { posts, totalPages: remoteTotalPages, status } = await fetchPostsPage(page)
    if (status !== 200 || !Array.isArray(posts) || posts.length === 0) break

    totalPages = Math.max(totalPages, remoteTotalPages || 1)
    let knownCount = 0

    for (const post of posts) {
      const existingItem = existingByUrl.get(post.link)
      if (isIncremental && existingItem) {
        collectedByUrl.set(existingItem.url, existingItem)
        knownCount += 1
        continue
      }

      const parsed = parsePost(post, now)
      if (!parsed) continue
      collectedByUrl.set(parsed.url, parsed)
    }

    if (isIncremental && knownCount === posts.length) {
      break
    }

    if (page >= totalPages) break
    await delay(250)
  }

  const merged = [
    ...collectedByUrl.values(),
    ...existing.filter(item => !collectedByUrl.has(item.url))
  ].map((item) => ({
    ...item,
    id: item.id || item.slug || item.url,
    topics: Array.isArray(item.topics) ? item.topics : []
  }))

  await mkdir(dirname(OUTPUT_FILE), { recursive: true })
  await writeFile(OUTPUT_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

  console.log(`Saved ${merged.length} sayings to ${OUTPUT_FILE}`)
  console.log(`Mode: ${isIncremental ? 'incremental' : 'full sync'}`)
}

run().catch((error) => {
  console.error('Failed to scrape sayings:', error)
  process.exitCode = 1
})
