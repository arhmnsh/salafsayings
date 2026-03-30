export const buildQuoteUrl = (item) => {
  const idPart = item?.id || item?.slug || 'quote'
  return `https://salafsayings.arhmn.sh/${idPart}`
}

export const buildSharePayload = (item) => ({
  title: item?.title || 'Salaf Saying',
  text: `"${item?.quote || ''}"${item?.author ? ` — ${item.author}` : ''}`,
  url: buildQuoteUrl(item)
})

export const buildClipboardText = (item) => {
  const payload = buildSharePayload(item)
  return `${payload.text}\n${payload.url}`
}

export const isShareAbortError = (error) =>
  !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'

const isLoopbackHost = (hostname = '') =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1'

export const canUseNativeShare = ({
  navigatorObj = globalThis.navigator,
  isSecureContextValue = globalThis.isSecureContext,
  locationObj = globalThis.location
} = {}) => {
  if (!navigatorObj?.share) return false
  if (isSecureContextValue) return true
  return isLoopbackHost(locationObj?.hostname)
}

export const canUseNativeFileShare = (
  files,
  {
    navigatorObj = globalThis.navigator,
    isSecureContextValue = globalThis.isSecureContext,
    locationObj = globalThis.location
  } = {}
) => {
  if (!canUseNativeShare({ navigatorObj, isSecureContextValue, locationObj })) return false
  if (typeof navigatorObj?.canShare !== 'function') return true
  return navigatorObj.canShare({ files })
}

export const copyTextWithFallback = async (
  text,
  {
    navigatorObj = globalThis.navigator,
    documentObj = globalThis.document
  } = {}
) => {
  if (navigatorObj?.clipboard?.writeText) {
    await navigatorObj.clipboard.writeText(text)
    return 'clipboard'
  }

  if (!documentObj?.createElement || !documentObj?.body?.appendChild || !documentObj?.execCommand) {
    throw new Error('Clipboard unavailable')
  }

  const textarea = documentObj.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  documentObj.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange?.(0, text.length)

  const didCopy = documentObj.execCommand('copy')
  textarea.remove()

  if (!didCopy) {
    throw new Error('Clipboard unavailable')
  }

  return 'execCommand'
}
