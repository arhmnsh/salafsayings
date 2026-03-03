<script setup lang="ts">
import { AlertTriangle, AtSign, Bookmark, BookMarked, ChevronDown, ChevronUp, Copy, Globe, Hash, Home, Image, Info, Link2, Mail, Search, Share2, Shuffle } from 'lucide-vue-next'
import QRCode from 'qrcode'

definePageMeta({ layout: false, key: 'salafsayings-feed' })
const route = useRoute()
const router = useRouter()

const { data: sayingsData } = await useAsyncData('salafsayings', () =>
  queryCollection('salafsayings').all()
)

const sayings = computed(() => {
  if (!sayingsData.value || sayingsData.value.length === 0) return []
  return (sayingsData.value[0]?.meta?.body || []) as any[]
})

type QueryToken = {
  type: 'tag' | 'text' | 'or'
  value: string
  normalized?: string
}
type ViewMode = 'home' | 'bookmarks' | 'about'

const normalizeTagText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const allTags = computed(() => {
  const counts = new Map<string, number>()
  sayings.value.forEach((item: any) => {
    ;(item.topics || []).forEach((topic: string) => {
      counts.set(topic, (counts.get(topic) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, normalized: normalizeTagText(name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const queryTokens = ref<QueryToken[]>([])
const viewMode = ref<ViewMode>('home')
const bookmarkedIds = ref<string[]>([])
const draftInput = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const suggestionIndex = ref(0)
const allTagsByNormalized = computed(() =>
  new Map(allTags.value.map(tag => [tag.normalized, tag.name]))
)
const selectedTagSet = computed(() =>
  new Set(queryTokens.value.filter(t => t.type === 'tag').map(t => t.normalized || ''))
)
const bookmarkedSet = computed(() => new Set(bookmarkedIds.value))
const activeFilterItems = computed(() =>
  queryTokens.value
    .map((token, index) => ({ token, index }))
    .filter(item => item.token.type !== 'or')
)
const isTagDraft = computed(() => draftInput.value.trim().startsWith('#'))
const matchingTags = computed(() => {
  if (!isTagDraft.value) return []
  const q = normalizeTagText(draftInput.value.trim().slice(1))
  if (!q) return []
  return allTags.value
    .filter(tag => !selectedTagSet.value.has(tag.normalized))
    .filter(tag => tag.normalized.includes(q))
    .slice(0, 8)
})

const cleanupTokens = () => {
  const cleaned: QueryToken[] = []
  for (const token of queryTokens.value) {
    if (token.type === 'or') {
      if (!cleaned.length) continue
      if (cleaned[cleaned.length - 1]?.type === 'or') continue
      cleaned.push(token)
      continue
    }
    if (!token.value?.trim()) continue
    if (!token.normalized) continue
    cleaned.push(token)
  }
  if (cleaned[cleaned.length - 1]?.type === 'or') {
    cleaned.pop()
  }
  queryTokens.value = cleaned
}

const addTagToken = (rawValue: string) => {
  const normalized = normalizeTagText(rawValue)
  if (!normalized) return
  const canonical = allTagsByNormalized.value.get(normalized) || rawValue.trim()
  queryTokens.value.push({ type: 'tag', value: canonical, normalized })
  cleanupTokens()
}

const addTextToken = (rawValue: string) => {
  const value = rawValue.trim()
  const normalized = normalizeTagText(value)
  if (!normalized) return
  queryTokens.value.push({ type: 'text', value, normalized })
  cleanupTokens()
}

const addOrToken = () => {
  if (!queryTokens.value.length) return
  if (queryTokens.value[queryTokens.value.length - 1]?.type === 'or') return
  queryTokens.value.push({ type: 'or', value: 'OR' })
}

const commitDraft = () => {
  const raw = draftInput.value.trim()
  if (!raw) return
  const lower = raw.toLowerCase()
  if (lower === 'or' || raw === '|') {
    addOrToken()
    draftInput.value = ''
    return
  }
  if (lower === 'and' || raw === '&' || raw === '*') {
    draftInput.value = ''
    return
  }

  if (raw.startsWith('#')) {
    const tagName = raw.slice(1).trim()
    if (tagName) addTagToken(tagName)
    draftInput.value = ''
    return
  }

  addTextToken(raw)
  draftInput.value = ''
}

const removeTokenAt = (index: number) => {
  queryTokens.value.splice(index, 1)
  cleanupTokens()
}

const removeLastToken = () => {
  if (!queryTokens.value.length) return
  queryTokens.value.pop()
  cleanupTokens()
}

const commitTagFromSuggestion = (tagName: string) => {
  addTagToken(tagName)
  draftInput.value = ''
  suggestionIndex.value = 0
  nextTick(() => {
    searchInput.value?.focus()
  })
}

const filteredSayings = computed(() => {
  const textTerms = queryTokens.value
    .filter(t => t.type === 'text' && t.normalized)
    .map(t => t.normalized as string)
  const tagTokens = queryTokens.value.filter(t => t.type === 'tag')

  let validGroups: string[][] = []
  for (const token of queryTokens.value) {
    if (token.type === 'text') continue
    if (!validGroups.length) validGroups = [[]]
    if (token.type === 'or') {
      if (validGroups[validGroups.length - 1].length > 0) {
        validGroups.push([])
      }
      continue
    }
    if (token.normalized) {
      validGroups[validGroups.length - 1].push(token.normalized)
    }
  }
  validGroups = validGroups.filter(group => group.length > 0)

  const searchableSayings = sayings.value.filter((item: any) => {
    const topicSet = new Set((item.topics || []).map((topic: string) => normalizeTagText(topic)))
    const haystack = normalizeTagText(
      [item.quote, item.intro, item.author, item.source, item.title, ...(item.topics || [])]
        .filter(Boolean)
        .join(' ')
    )

    const textMatches = textTerms.every(term => haystack.includes(term))
    const tagMatches = !tagTokens.length || validGroups.some(group => group.every(term => topicSet.has(term)))
    return textMatches && tagMatches
  })

  if (viewMode.value === 'bookmarks') {
    return searchableSayings.filter(item => bookmarkedSet.value.has(getRouteIdForItem(item)))
  }
  return searchableSayings
})

const activeIndex = ref(0)
const copied = ref(false)
const linkCopied = ref(false)
const shared = ref(false)
const imageShared = ref(false)
const shareError = ref('')
const contentScroller = ref<HTMLElement | null>(null)
const touchStartY = ref<number | null>(null)
const touchLastY = ref<number | null>(null)
const touchEdgeAccum = ref(0)
const touchEdgeDirection = ref<1 | -1 | null>(null)
const touchNavTriggered = ref(false)
const wheelEdgeAccum = ref(0)
const wheelEdgeDirection = ref<1 | -1 | null>(null)
const wheelCooldownUntil = ref(0)
const wheelResetTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const cardOffset = ref(0)
const cardAnimating = ref(false)
const cardTeleporting = ref(false)
const showFirstVisitHint = ref(false)
const showSearchPopup = ref(false)
const showShareMenu = ref(false)
const TOUCH_SWITCH_THRESHOLD = 70
const WHEEL_SWITCH_THRESHOLD = 180
const WHEEL_COOLDOWN_MS = 320
const WHEEL_RESET_MS = 150
const CARD_EXIT_OFFSET = 200
const CARD_SWAP_MS = 110
const CARD_SETTLE_MS = 170

const current = computed(() => filteredSayings.value[activeIndex.value] || null)
const isAboutView = computed(() => viewMode.value === 'about')
const progressLabel = computed(() =>
  filteredSayings.value.length === 0 ? '0 / 0' : `${activeIndex.value + 1} / ${filteredSayings.value.length}`
)
const isCurrentBookmarked = computed(() =>
  current.value ? bookmarkedSet.value.has(getRouteIdForItem(current.value)) : false
)
const cardStyle = computed(() => ({
  transform: `translate3d(0, ${cardOffset.value}px, 0)`
}))
const cardMotionClass = computed(() =>
  cardTeleporting.value ? '' : 'transition-transform duration-200 ease-out'
)
const getRouteIdForItem = (item: any) => String(item?.id || item?.slug || '')
const getRouteParamId = () => {
  const raw = route.params.id
  if (Array.isArray(raw)) return raw[0] || ''
  return raw ? String(raw) : ''
}

const syncUrlToCurrent = async () => {
  if (showSearchPopup.value) return
  if (!filteredSayings.value.length || !current.value) return
  const nextId = getRouteIdForItem(current.value)
  if (!nextId || getRouteParamId() === nextId) return
  await router.replace({ path: `/${encodeURIComponent(nextId)}` })
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const move = (dir: 1 | -1) => {
  if (isAboutView.value) return
  showShareMenu.value = false
  if (cardAnimating.value) return
  if (!filteredSayings.value.length) return
  const nextIndex = activeIndex.value + dir
  if (nextIndex < 0 || nextIndex >= filteredSayings.value.length) return
  cardAnimating.value = true

  ;(async () => {
    cardOffset.value = dir === 1 ? -CARD_EXIT_OFFSET : CARD_EXIT_OFFSET
    await wait(CARD_SWAP_MS)

    activeIndex.value = nextIndex
    if (contentScroller.value) {
      contentScroller.value.scrollTop = 0
    }

    cardTeleporting.value = true
    cardOffset.value = dir === 1 ? CARD_EXIT_OFFSET : -CARD_EXIT_OFFSET
    await nextFrame()
    cardTeleporting.value = false
    await nextFrame()

    cardOffset.value = 0
    await wait(CARD_SETTLE_MS)
    cardAnimating.value = false
  })()
}

const getScrollEdges = (el: HTMLElement) => {
  const top = el.scrollTop <= 1
  const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  return { top, bottom }
}

const onContentWheel = (event: WheelEvent) => {
  showShareMenu.value = false
  if (Math.abs(event.deltaY) < 2) return
  if (cardAnimating.value) {
    event.preventDefault()
    return
  }
  const scroller = contentScroller.value
  if (!scroller) return
  const { top, bottom } = getScrollEdges(scroller)
  const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1
  const canScrollInDirection = direction === 1 ? !bottom : !top

  if (canScrollInDirection) {
    wheelEdgeAccum.value = 0
    wheelEdgeDirection.value = null
    if (wheelResetTimer.value) {
      clearTimeout(wheelResetTimer.value)
      wheelResetTimer.value = null
    }
    return
  }

  event.preventDefault()
  const now = Date.now()
  if (now < wheelCooldownUntil.value) return

  if (wheelEdgeDirection.value !== direction) {
    wheelEdgeDirection.value = direction
    wheelEdgeAccum.value = 0
  }

  wheelEdgeAccum.value += Math.min(80, Math.abs(event.deltaY))
  if (wheelEdgeAccum.value >= WHEEL_SWITCH_THRESHOLD) {
    wheelEdgeAccum.value = 0
    wheelEdgeDirection.value = null
    wheelCooldownUntil.value = now + WHEEL_COOLDOWN_MS
    move(direction)
    return
  }

  if (wheelResetTimer.value) {
    clearTimeout(wheelResetTimer.value)
  }
  wheelResetTimer.value = setTimeout(() => {
    wheelEdgeAccum.value = 0
    wheelEdgeDirection.value = null
  }, WHEEL_RESET_MS)
}

const onContentTouchStart = (event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-share-menu]') || target?.closest('[data-search-popup]')) {
    return
  }
  showShareMenu.value = false
  touchStartY.value = event.touches[0]?.clientY ?? null
  touchLastY.value = touchStartY.value
  touchEdgeAccum.value = 0
  touchEdgeDirection.value = null
  touchNavTriggered.value = false
}

const onContentTouchMove = (event: TouchEvent) => {
  if (touchStartY.value === null) return
  if (touchNavTriggered.value) {
    if (event.cancelable) event.preventDefault()
    return
  }
  const scroller = contentScroller.value
  if (!scroller) return
  const currentY = event.touches[0]?.clientY ?? touchStartY.value
  const lastY = touchLastY.value ?? currentY
  const stepDelta = currentY - lastY
  touchLastY.value = currentY
  if (Math.abs(stepDelta) < 1) return
  const { top, bottom } = getScrollEdges(scroller)
  const direction: 1 | -1 = stepDelta < 0 ? 1 : -1
  const canScrollInDirection = direction === 1 ? !bottom : !top

  if (canScrollInDirection) {
    touchEdgeAccum.value = 0
    touchEdgeDirection.value = null
    return
  }

  if (event.cancelable) event.preventDefault()

  if (touchEdgeDirection.value !== direction) {
    touchEdgeDirection.value = direction
    touchEdgeAccum.value = 0
  }

  touchEdgeAccum.value += Math.abs(stepDelta)
  if (touchEdgeAccum.value >= TOUCH_SWITCH_THRESHOLD) {
    touchNavTriggered.value = true
    touchEdgeAccum.value = 0
    touchEdgeDirection.value = null
    move(direction)
  }
}

const onContentTouchEnd = () => {
  touchStartY.value = null
  touchLastY.value = null
  touchEdgeAccum.value = 0
  touchEdgeDirection.value = null
  touchNavTriggered.value = false
}

const lockViewportScroll = () => {
  if (!import.meta.client) return
  const html = document.documentElement
  const body = document.body
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  html.style.overscrollBehaviorY = 'none'
  body.style.overscrollBehaviorY = 'none'
}

const unlockViewportScroll = () => {
  if (!import.meta.client) return
  const html = document.documentElement
  const body = document.body
  html.style.removeProperty('overflow')
  body.style.removeProperty('overflow')
  html.style.removeProperty('overscroll-behavior-y')
  body.style.removeProperty('overscroll-behavior-y')
}

const onRootTouchMove = (event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-content-scroller]') || target?.closest('[data-search-popup]') || target?.closest('[data-share-menu]')) {
    return
  }
  if (event.cancelable) {
    event.preventDefault()
  }
}

const shuffle = () => {
  if (isAboutView.value) return
  showShareMenu.value = false
  if (filteredSayings.value.length < 2) return
  let nextIndex = activeIndex.value
  while (nextIndex === activeIndex.value) {
    nextIndex = Math.floor(Math.random() * filteredSayings.value.length)
  }
  activeIndex.value = nextIndex
}

const toggleBookmarkCurrent = () => {
  if (isAboutView.value) return
  if (!current.value) return
  const id = getRouteIdForItem(current.value)
  if (!id) return
  if (bookmarkedSet.value.has(id)) {
    bookmarkedIds.value = bookmarkedIds.value.filter(existing => existing !== id)
    return
  }
  bookmarkedIds.value = [...bookmarkedIds.value, id]
}

const copyCurrent = async () => {
  if (isAboutView.value) return
  if (!current.value || !import.meta.client) return
  const shareUrl = getPublicQuoteUrl(current.value)
  const payload = `"${current.value.quote}"${current.value.author ? ` — ${current.value.author}` : ''}\n${shareUrl}`
  await navigator.clipboard.writeText(payload)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1200)
}

const getPublicQuoteUrl = (item: any) => {
  const idPart = item?.id || item?.slug || 'quote'
  return `https://salafsayings.arhmn.sh/${idPart}`
}

const getShareText = (item: any) => {
  const url = getPublicQuoteUrl(item)
  return `"${item.quote}"${item.author ? ` — ${item.author}` : ''}\n${url}`
}

const shareCurrent = async () => {
  if (isAboutView.value) return
  if (!current.value || !import.meta.client) return
  shareError.value = ''
  const text = getShareText(current.value)

  try {
    if (navigator.share) {
      await navigator.share({
        title: current.value.title || 'Salaf Saying',
        text
      })
    } else {
      await navigator.clipboard.writeText(text)
    }
    showShareMenu.value = false
    shared.value = true
    setTimeout(() => {
      shared.value = false
    }, 1200)
  } catch {
    try {
      await navigator.clipboard.writeText(text)
      shared.value = true
      setTimeout(() => {
        shared.value = false
      }, 1200)
      showShareMenu.value = false
    } catch {
      shareError.value = 'Share failed'
      setTimeout(() => {
        shareError.value = ''
      }, 1400)
    }
  }
}

const wrapCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const splitWordByWidth = (word: string) => {
    const chunks: string[] = []
    let chunk = ''
    for (const char of word) {
      const next = chunk + char
      if (ctx.measureText(next).width <= maxWidth) {
        chunk = next
      } else {
        if (chunk) chunks.push(chunk)
        chunk = char
      }
    }
    if (chunk) chunks.push(chunk)
    return chunks
  }

  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      const chunks = splitWordByWidth(word)
      for (const chunk of chunks) {
        const trialChunk = line ? `${line} ${chunk}` : chunk
        if (ctx.measureText(trialChunk).width <= maxWidth) {
          line = trialChunk
        } else {
          if (line) lines.push(line)
          line = chunk
        }
      }
      continue
    }

    const trial = line ? `${line} ${word}` : word
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const drawLinkIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  const half = size / 2
  const radius = size * 0.22
  const lineWidth = Math.max(2, size * 0.11)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.82)'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.arc(x - half * 0.35, y + half * 0.08, radius, Math.PI * 0.2, Math.PI * 1.28)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + half * 0.35, y - half * 0.08, radius, Math.PI * 1.2, Math.PI * 0.22, true)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x - half * 0.18, y + half * 0.18)
  ctx.lineTo(x + half * 0.18, y - half * 0.18)
  ctx.stroke()
  ctx.restore()
}

const renderShareImageBlob = async () => {
  if (!current.value || !import.meta.client) return null
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#060B1A')
  gradient.addColorStop(0.5, '#0E172F')
  gradient.addColorStop(1, '#0A1226')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#1D4ED8'
  ctx.beginPath()
  ctx.arc(960, 1200, 360, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#F59E0B'
  ctx.beginPath()
  ctx.arc(120, 120, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  const cardX = 80
  const cardY = 120
  const cardW = 920
  const cardH = 1040
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44)
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 30px Inter, system-ui, sans-serif'
  ctx.fillText('SALAF SAYINGS', cardX + 56, cardY + 72)

  let cursorY = cardY + 150
  if (current.value.intro) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '400 34px Inter, system-ui, sans-serif'
    const introLines = wrapCanvasText(ctx, current.value.intro, cardW - 112)
    for (const line of introLines.slice(0, 5)) {
      ctx.fillText(line, cardX + 56, cursorY)
      cursorY += 46
    }
    cursorY += 24
  }

  ctx.fillStyle = '#F8FAFC'
  ctx.font = '500 60px "IBM Plex Serif", Georgia, serif'
  const quoteLines = wrapCanvasText(ctx, `“${current.value.quote}”`, cardW - 112)
  for (const line of quoteLines.slice(0, 10)) {
    ctx.fillText(line, cardX + 56, cursorY)
    cursorY += 76
  }

  cursorY = Math.min(cursorY + 12, cardY + cardH - 240)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cardX + 56, cursorY)
  ctx.lineTo(cardX + cardW - 56, cursorY)
  ctx.stroke()

  cursorY += 54
  if (current.value.author) {
    ctx.fillStyle = '#FDE68A'
    ctx.font = '600 40px Inter, system-ui, sans-serif'
    ctx.fillText(current.value.author.toUpperCase(), cardX + 56, cursorY)
    cursorY += 58
  }

  const sourceUrl = getPublicQuoteUrl(current.value)
  const qrSize = 132
  const qrBoxX = cardX + cardW - 56 - qrSize
  const qrBoxY = cardY + cardH - 56 - qrSize

  try {
    const createFn = (QRCode as any)?.create || (QRCode as any)?.default?.create
    if (!createFn) throw new Error('QRCode.create unavailable')
    const qr = createFn(sourceUrl, { errorCorrectionLevel: 'M' })
    const moduleCount = qr?.modules?.size
    const moduleData = qr?.modules?.data as boolean[] | undefined
    if (!moduleCount || !moduleData) throw new Error('QR modules unavailable')

    const moduleSize = Math.max(2, Math.floor(qrSize / moduleCount))
    const renderedSize = moduleSize * moduleCount
    const qrOffset = Math.floor((qrSize - renderedSize) / 2)

    drawRoundedRect(ctx, qrBoxX - 8, qrBoxY - 8, qrSize + 16, qrSize + 16, 14)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(qrBoxX, qrBoxY, qrSize, qrSize)
    ctx.fillStyle = '#0F172A'
    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        if (moduleData[y * moduleCount + x]) {
          ctx.fillRect(
            qrBoxX + qrOffset + x * moduleSize,
            qrBoxY + qrOffset + y * moduleSize,
            moduleSize,
            moduleSize
          )
        }
      }
    }
  } catch (error) {
    console.warn('QR rendering failed', error)
    drawRoundedRect(ctx, qrBoxX - 8, qrBoxY - 8, qrSize + 16, qrSize + 16, 14)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '600 26px Inter, system-ui, sans-serif'
    ctx.fillText('QR', qrBoxX + 40, qrBoxY + 74)
  }

  const sourceTextX = cardX + 56
  let sourceTextY = qrBoxY + 6
  const sourceTextMaxWidth = Math.max(300, qrBoxX - sourceTextX - 24)
  drawLinkIcon(ctx, sourceTextX + 12, sourceTextY + 14, 20)

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = '400 24px Inter, system-ui, sans-serif'
  const sourceLines = wrapCanvasText(ctx, sourceUrl, sourceTextMaxWidth)
  for (const line of sourceLines.slice(0, 4)) {
    ctx.fillText(line, sourceTextX + 30, sourceTextY + 20)
    sourceTextY += 34
  }

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1)
  })
}

const shareImageCurrent = async () => {
  if (isAboutView.value) return
  if (!current.value || !import.meta.client) return
  shareError.value = ''
  const blob = await renderShareImageBlob()
  if (!blob) return

  const file = new File([blob], `salaf-saying-${current.value.slug || current.value.id}.png`, { type: 'image/png' })
  try {
    const shareText = getPublicQuoteUrl(current.value)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: current.value.title || 'Salaf Saying',
        text: shareText,
        files: [file]
      })
    } else {
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      await navigator.clipboard.writeText(shareText)
    }
    showShareMenu.value = false
    imageShared.value = true
    setTimeout(() => {
      imageShared.value = false
    }, 1400)
  } catch {
    shareError.value = 'Image share failed'
    setTimeout(() => {
      shareError.value = ''
    }, 1400)
  }
}

const copyCurrentLink = async () => {
  if (isAboutView.value) return
  if (!current.value || !import.meta.client) return
  showShareMenu.value = false
  shareError.value = ''
  try {
    await navigator.clipboard.writeText(getPublicQuoteUrl(current.value))
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 1200)
  } catch {
    shareError.value = 'Copy failed'
    setTimeout(() => {
      shareError.value = ''
    }, 1400)
  }
}

const reportCurrent = () => {
  if (isAboutView.value) return
  if (!current.value || !import.meta.client) return
  showShareMenu.value = false
  const quoteUrl = getPublicQuoteUrl(current.value)
  const id = getRouteIdForItem(current.value) || 'unknown'
  const nav = window.navigator
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
  const subject = `[Salaf Sayings] Issue report for quote ${id}`
  const body = [
    'Please write the issue details below this line:',
    '',
    '[Your comments]',
    '',
    '----',
    'Auto-collected details:',
    `Post URL: ${quoteUrl}`,
    `Post ID: ${id}`,
    `Post Author: ${current.value.author || 'Unknown'}`,
    `Page URL: ${window.location.href}`,
    `Time (ISO): ${new Date().toISOString()}`,
    `Timezone: ${timezone}`,
    `Browser (UA): ${nav.userAgent || 'Unknown'}`,
    `Platform: ${nav.platform || 'Unknown'}`,
    `Language: ${nav.language || 'Unknown'}`,
    `Viewport: ${window.innerWidth}x${window.innerHeight}`,
    `Screen: ${window.screen.width}x${window.screen.height}`,
    `Pixel ratio: ${window.devicePixelRatio || 1}`,
    `Touch points: ${nav.maxTouchPoints || 0}`
  ].join('\n')
  window.location.href = `mailto:hi@arhmn.sh?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const toggleTag = (tag: string) => {
  const normalized = normalizeTagText(tag)
  const exists = queryTokens.value.some(token => token.type === 'tag' && token.normalized === normalized)
  if (exists) {
    queryTokens.value = queryTokens.value.filter(token => !(token.type === 'tag' && token.normalized === normalized))
    cleanupTokens()
    return
  }
  addTagToken(tag)
}

const onSearchInputKeydown = (event: KeyboardEvent) => {
  const key = event.key
  const suggestions = matchingTags.value

  if (key === 'Backspace' && !draftInput.value) {
    event.preventDefault()
    removeLastToken()
    return
  }

  if (key === 'ArrowDown' && suggestions.length) {
    event.preventDefault()
    suggestionIndex.value = (suggestionIndex.value + 1) % suggestions.length
    return
  }

  if (key === 'ArrowUp' && suggestions.length) {
    event.preventDefault()
    suggestionIndex.value = (suggestionIndex.value - 1 + suggestions.length) % suggestions.length
    return
  }

  if (key === 'Enter' || key === ',' || key === '*' || key === '|') {
    event.preventDefault()
    if (key === 'Enter' && isTagDraft.value && suggestions.length && draftInput.value.trim()) {
      commitTagFromSuggestion(suggestions[suggestionIndex.value].name)
      return
    }
    commitDraft()
    if (key === '|') addOrToken()
    return
  }

  if (key === ' ') {
    const value = draftInput.value.trim()
    if (!value) return
    const isOperator = value.toLowerCase() === 'or' || value.toLowerCase() === 'and' || value === '|'
    if (isOperator || value.startsWith('#')) {
      event.preventDefault()
      commitDraft()
      if (value.toLowerCase() === 'or') addOrToken()
    }
  }
}

watch(filteredSayings, (next) => {
  if (!next.length) {
    activeIndex.value = 0
    return
  }
  const routeId = getRouteParamId()
  if (routeId) {
    const routeIndex = next.findIndex(item => getRouteIdForItem(item) === routeId)
    if (routeIndex >= 0) {
      activeIndex.value = routeIndex
      return
    }
  }
  if (activeIndex.value >= next.length || activeIndex.value < 0) {
    activeIndex.value = 0
  }
  syncUrlToCurrent()
}, { immediate: true })

watch(
  () => route.params.id,
  () => {
    const routeId = getRouteParamId()
    if (!filteredSayings.value.length) return
    if (!routeId) {
      syncUrlToCurrent()
      return
    }
    const routeIndex = filteredSayings.value.findIndex(item => getRouteIdForItem(item) === routeId)
    if (routeIndex >= 0 && routeIndex !== activeIndex.value) {
      activeIndex.value = routeIndex
      return
    }
    if (routeIndex < 0) {
      syncUrlToCurrent()
    }
  },
  { immediate: true }
)

watch(activeIndex, () => {
  syncUrlToCurrent()
})

watch(viewMode, (next) => {
  showShareMenu.value = false
  if (next === 'about') {
    showSearchPopup.value = false
  }
  nextTick(() => {
    if (contentScroller.value) {
      contentScroller.value.scrollTop = 0
    }
  })
})

watch(
  () => current.value ? getRouteIdForItem(current.value) : '',
  () => {
    if (contentScroller.value) {
      contentScroller.value.scrollTop = 0
    }
  }
)

onMounted(() => {
  lockViewportScroll()
  const storedBookmarks = localStorage.getItem('salafsayings-bookmarks')
  if (storedBookmarks) {
    try {
      const parsed = JSON.parse(storedBookmarks)
      if (Array.isArray(parsed)) {
        bookmarkedIds.value = parsed.map(item => String(item)).filter(Boolean)
      }
    } catch {
      // Ignore invalid bookmark payload.
    }
  }

  const firstVisitKey = 'salafsayings-swipe-hint-seen'
  if (!localStorage.getItem(firstVisitKey)) {
    showFirstVisitHint.value = true
    localStorage.setItem(firstVisitKey, '1')
    setTimeout(() => {
      showFirstVisitHint.value = false
    }, 3800)
  }

  const handler = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'j') move(1)
    if (event.key === 'ArrowUp' || event.key === 'k') move(-1)
  }
  window.addEventListener('keydown', handler)
  onUnmounted(() => {
    window.removeEventListener('keydown', handler)
    if (wheelResetTimer.value) {
      clearTimeout(wheelResetTimer.value)
      wheelResetTimer.value = null
    }
    unlockViewportScroll()
  })
})

watch(showSearchPopup, (isOpen) => {
  if (!isOpen) {
    draftInput.value = ''
    syncUrlToCurrent()
    return
  }
  nextTick(() => {
    searchInput.value?.focus()
  })
})

watch(showShareMenu, (isOpen) => {
  if (isOpen) {
    showSearchPopup.value = false
  }
})

watch(draftInput, () => {
  suggestionIndex.value = 0
})

watch(bookmarkedIds, (next) => {
  if (!import.meta.client) return
  localStorage.setItem('salafsayings-bookmarks', JSON.stringify(next))
})
</script>

<template>
  <div
    class="relative h-dvh overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.14),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.12),transparent_38%),linear-gradient(145deg,#09090b,#111827_45%,#1f2937)] text-white"
    @touchmove="onRootTouchMove"
  >
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(17,24,39,0.9),rgba(17,24,39,0.18)_45%,rgba(17,24,39,0.9))]" />

    <Teleport to="body">
      <div class="fixed inset-x-0 top-0 z-40 pointer-events-none">
        <header class="pointer-events-auto flex items-center justify-between bg-[linear-gradient(180deg,rgba(9,9,11,0.95),rgba(9,9,11,0.65),transparent)] px-5 py-4 backdrop-blur-sm sm:px-8">
          <div>
            <p class="font-mono text-xs uppercase tracking-[0.2em] text-white/70">Salaf Sayings</p>
            <a
              href="https://arhmn.sh"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-block text-[11px] text-white/55 transition hover:text-white/85"
            >
              by AbdurRahaman Shah arhmn.sh
            </a>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="rounded-full border border-white/20 bg-black/30 p-2 text-white/90 transition hover:bg-black/55"
              @click="showSearchPopup = true"
            >
              <Search class="h-4 w-4" />
            </button>
            <div class="min-w-[6.5rem] rounded-full border border-white/20 bg-black/20 px-3 py-1 text-center font-mono text-xs tabular-nums text-white/80">
              {{ progressLabel }}
            </div>
          </div>
        </header>
        <div
          v-if="activeFilterItems.length"
          class="pointer-events-auto bg-[linear-gradient(180deg,rgba(9,9,11,0.92),rgba(9,9,11,0.48),transparent)] px-5 pb-2 backdrop-blur-sm sm:px-8"
        >
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in activeFilterItems"
              :key="`active-filter-${item.index}-${item.token.value}`"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition"
              :class="item.token.type === 'tag'
                ? 'border-amber-200/60 bg-amber-200/20 text-amber-100 hover:bg-amber-200/30'
                : 'border-sky-200/50 bg-sky-200/15 text-sky-100 hover:bg-sky-200/25'"
              @click="removeTokenAt(item.index)"
            >
              <Hash v-if="item.token.type === 'tag'" class="h-3 w-3" />
              <Search v-else class="h-3 w-3" />
              {{ item.token.value }}
              <span class="ml-1 text-[11px] opacity-80">×</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <main
      class="relative z-10 flex h-dvh items-start justify-center overflow-hidden px-5 pb-32 sm:px-8"
      :class="activeFilterItems.length ? 'pt-32' : 'pt-24'"
    >
      <div
        ref="contentScroller"
        data-content-scroller
        class="h-full w-full max-w-4xl overflow-y-auto overscroll-contain [touch-action:pan-y]"
        @wheel="onContentWheel"
        @touchstart.passive="onContentTouchStart"
        @touchmove="onContentTouchMove"
        @touchend.passive="onContentTouchEnd"
        @touchcancel.passive="onContentTouchEnd"
      >
        <section
          v-if="isAboutView"
          class="w-full min-h-[calc(100dvh-12rem)] bg-[linear-gradient(180deg,rgba(2,6,23,0.72),rgba(2,6,23,0.52))] px-6 py-8 sm:min-h-[calc(100dvh-13.5rem)] sm:px-10 sm:py-10"
        >
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">About</p>
          <h2 class="mt-2 font-serif text-3xl text-white sm:text-4xl">Salaf Sayings</h2>
          <p class="mt-5 max-w-2xl text-sm leading-relaxed text-white/78 sm:text-base">
            A focused space to read concise reminders from the Salaf with an interface designed for calm, quick reflection.
          </p>
          <p class="mt-8 text-xs uppercase tracking-[0.18em] text-white/55">By</p>
          <p class="mt-2 text-lg text-white">AbdurRahaman Shah</p>

          <div class="mt-8 flex flex-col items-start gap-3 text-sm text-white/90">
            <a
              href="https://arhmn.sh"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 text-amber-200 transition hover:text-amber-100"
            >
              <Globe class="h-4 w-4 text-amber-200/85" />
              arhmn.sh
            </a>
            <a
              href="https://x.com/arhmnsh"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 transition hover:text-white"
            >
              <AtSign class="h-4 w-4 text-white/65" />
              X / @arhmnsh
            </a>
            <a
              href="mailto:hi@arhmn.sh"
              class="inline-flex items-center gap-2 transition hover:text-white"
            >
              <Mail class="h-4 w-4 text-white/65" />
              hi@arhmn.sh
            </a>
          </div>
        </section>

        <div :class="cardMotionClass" :style="cardStyle">
          <article
            v-if="current && !isAboutView"
            :key="current.id"
            class="w-full min-h-[calc(100dvh-12rem)] rounded-3xl border border-white/20 bg-black/35 p-7 shadow-2xl backdrop-blur-xl sm:min-h-[calc(100dvh-13.5rem)] sm:p-10"
          >
            <p v-if="current.intro" class="mb-5 font-sans text-sm leading-relaxed text-white/70 sm:text-base">
              {{ current.intro }}
            </p>

            <blockquote class="font-serif text-2xl leading-snug sm:text-4xl">
              “{{ current.quote }}”
            </blockquote>

            <div class="mt-7 border-t border-white/15 pt-5">
              <p v-if="current.author" class="font-sans text-sm font-semibold uppercase tracking-[0.15em] text-amber-200/90">
                {{ current.author }}
              </p>
              <p v-if="current.source" class="mt-2 text-xs leading-relaxed text-white/65 sm:text-sm">
                {{ current.source }}
              </p>
              <div v-if="current.topics?.length" class="mt-4 flex flex-wrap gap-2">
                <button
                  v-for="topic in current.topics"
                  :key="topic"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85 transition hover:bg-white/20"
                  @click.stop="toggleTag(topic)"
                >
                  <Hash class="h-3 w-3" />
                  {{ topic }}
                </button>
              </div>
            </div>
          </article>

          <div v-else-if="!isAboutView" key="empty" class="w-full border border-white/15 bg-black/30 px-6 py-16 text-center text-white/72">
            {{ viewMode === 'bookmarks'
              ? 'No bookmarked sayings yet. Save a post from Home to find it here.'
              : 'No sayings found with current filters.' }}
          </div>
        </div>
      </div>
    </main>

    <div v-if="!isAboutView" class="fixed right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3 sm:right-6">
      <button
        class="rounded-full border border-white/20 bg-black/35 p-3 text-white/90 transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="activeIndex === 0"
        @click="move(-1)"
      >
        <ChevronUp class="h-5 w-5" />
      </button>
      <button
        class="rounded-full border border-white/20 bg-black/35 p-3 text-white/90 transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="activeIndex >= filteredSayings.length - 1"
        @click="move(1)"
      >
        <ChevronDown class="h-5 w-5" />
      </button>
      <button
        class="rounded-full border border-white/20 bg-black/35 p-3 text-white/90 transition hover:bg-black/60"
        @click="shuffle"
      >
        <Shuffle class="h-5 w-5" />
      </button>
      <button
        class="rounded-full border p-3 transition"
        :class="isCurrentBookmarked
          ? 'border-amber-200/70 bg-amber-200/20 text-amber-100 hover:bg-amber-200/30'
          : 'border-white/20 bg-black/35 text-white/90 hover:bg-black/60'"
        @click="toggleBookmarkCurrent"
      >
        <Bookmark class="h-5 w-5" />
      </button>
      <button
        class="rounded-full border border-white/20 bg-black/35 p-3 text-white/90 transition hover:bg-black/60"
        @click="showShareMenu = !showShareMenu"
      >
        <Share2 class="h-5 w-5" />
      </button>
      <button
        class="rounded-full border border-white/20 bg-black/35 p-3 text-white/90 transition hover:bg-black/60"
        @click="reportCurrent"
      >
        <AlertTriangle class="h-5 w-5" />
      </button>
    </div>

    <div
      v-if="showShareMenu && !isAboutView"
      class="fixed inset-0 z-20"
      @click="showShareMenu = false"
    />

    <div
      v-if="showShareMenu && !isAboutView"
      class="fixed right-20 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 rounded-xl border border-white/20 bg-black/70 p-2 backdrop-blur-md"
      data-share-menu
      @click.stop
    >
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/90 transition hover:bg-white/10"
        @click.stop="shareCurrent()"
      >
        <Share2 class="h-4 w-4" />
        Share Text
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/90 transition hover:bg-white/10"
        @click.stop="copyCurrent(); showShareMenu = false"
      >
        <Copy class="h-4 w-4" />
        Copy
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/90 transition hover:bg-white/10"
        @click.stop="shareImageCurrent()"
      >
        <Image class="h-4 w-4" />
        Share Image
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/90 transition hover:bg-white/10"
        @click.stop="copyCurrentLink()"
      >
        <Link2 class="h-4 w-4" />
        Copy URL
      </button>
    </div>

    <div class="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs text-white/75">
      {{ copied ? 'Copied' : linkCopied ? 'Link copied' : imageShared ? 'Image ready to share' : shared ? 'Shared' : shareError || (showFirstVisitHint ? 'Swipe up/down like TikTok' : 'Swipe, scroll, or use ↑ ↓') }}
    </div>

    <nav class="fixed inset-x-0 bottom-4 z-40">
      <div class="mx-auto w-[min(88vw,22rem)] rounded-[1.4rem] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div class="flex items-center gap-1 rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(7,16,35,0.8),rgba(4,10,24,0.62))] px-1.5 py-1">
        <button
          type="button"
          aria-label="Home"
          class="flex h-10 flex-1 items-center justify-center rounded-[0.95rem] transition"
          :class="viewMode === 'home'
            ? 'bg-white/[0.14] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]'
            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'"
          @click="viewMode = 'home'"
        >
          <Home class="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Bookmarks"
          class="flex h-10 flex-1 items-center justify-center rounded-[0.95rem] transition"
          :class="viewMode === 'bookmarks'
            ? 'bg-white/[0.14] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]'
            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'"
          @click="viewMode = 'bookmarks'"
        >
          <BookMarked class="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          aria-label="About"
          class="flex h-10 flex-1 items-center justify-center rounded-[0.95rem] transition"
          :class="viewMode === 'about'
            ? 'bg-white/[0.14] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]'
            : 'text-white/75 hover:bg-white/[0.08] hover:text-white'"
          @click="viewMode = 'about'"
        >
          <Info class="h-[18px] w-[18px]" />
        </button>
        </div>
      </div>
    </nav>

    <div
      v-if="showSearchPopup"
      class="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
      @click.self="showSearchPopup = false"
      @mousedown.self="showSearchPopup = false"
      @touchstart.self="showSearchPopup = false"
    >
      <div
        class="absolute left-1/2 top-20 w-[92%] max-w-2xl -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-2xl"
        data-search-popup
        @pointerdown.stop
        @touchstart.stop
        @click.stop
      >
        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
          <Search class="h-4 w-4 text-white/70" />
          <template v-for="(token, idx) in queryTokens" :key="`${token.type}-${token.value}-${idx}`">
            <span
              v-if="token.type === 'tag'"
              class="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-200/15 px-2 py-1 text-xs text-amber-100"
            >
              <Hash class="h-3 w-3" />
              {{ token.value }}
              <button type="button" class="text-amber-100/80 hover:text-white" @click.stop="removeTokenAt(idx)">
                ×
              </button>
            </span>
            <span
              v-else-if="token.type === 'or'"
              class="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[11px] uppercase tracking-wider text-white/80"
            >
              OR
              <button type="button" class="text-white/70 hover:text-white" @click.stop="removeTokenAt(idx)">
                ×
              </button>
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 rounded-full border border-sky-200/40 bg-sky-200/10 px-2 py-1 text-xs text-sky-100"
            >
              {{ token.value }}
              <button type="button" class="text-sky-100/80 hover:text-white" @click.stop="removeTokenAt(idx)">
                ×
              </button>
            </span>
          </template>
          <input
            ref="searchInput"
            v-model="draftInput"
            type="text"
            placeholder="Search text, or type #tag"
            class="min-w-[170px] flex-1 bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none"
            @keydown="onSearchInputKeydown"
          />
        </div>
        <div
          v-if="draftInput.trim() && matchingTags.length"
          class="mt-2 rounded-xl border border-white/15 bg-slate-900/85 p-2"
        >
          <p class="px-2 pb-1 text-[11px] uppercase tracking-wider text-white/45">Matching Tags</p>
          <div class="max-h-36 overflow-y-auto">
            <button
              v-for="(tag, idx) in matchingTags"
              :key="`suggestion-${tag.name}`"
              type="button"
              class="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition"
              :class="idx === suggestionIndex ? 'bg-amber-200/20 text-amber-100' : 'text-white/85 hover:bg-white/10'"
              @click.stop="commitTagFromSuggestion(tag.name)"
            >
              <span>{{ tag.name }}</span>
              <span class="text-xs text-white/50">{{ tag.count }}</span>
            </button>
          </div>
        </div>
        <div class="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
          <button
            v-for="tag in allTags"
            :key="tag.name"
            type="button"
            class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition"
            :class="selectedTagSet.has(tag.normalized)
              ? 'border-amber-200/60 bg-amber-200/20 text-amber-100'
              : 'border-white/20 bg-white/10 text-white/85 hover:bg-white/20'"
            @click.stop="toggleTag(tag.name)"
          >
            <Hash class="h-3 w-3" />
            {{ tag.name }} <span class="text-white/60">{{ tag.count }}</span>
          </button>
        </div>
        <p class="mt-3 text-xs text-white/60">
          Type plain words to search quote text, author, and source. For tag filters, start with <code class="text-white/85">#</code> and pick a tag. Use <code class="text-white/85">or</code> (or <code class="text-white/85">|</code>) between tags for either/or.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(html),
:global(body) {
  background: #09090b;
  overscroll-behavior-y: none;
}

[data-content-scroller] {
  -webkit-overflow-scrolling: touch;
}
</style>
