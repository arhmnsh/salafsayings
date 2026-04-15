export const SHARE_IMAGE_DIMENSIONS = {
  width: 1080,
  cardX: 80,
  cardY: 120,
  cardRadius: 44,
  cardPaddingX: 56,
  cardPaddingTop: 72,
  cardPaddingBottom: 56,
  introTopGap: 78,
  introLineHeight: 46,
  introGapAfter: 24,
  quoteLineHeight: 76,
  dividerGapBefore: 12,
  dividerGapAfter: 54,
  authorLineHeight: 58,
  sectionGapAfterAuthor: 18,
  qrSize: 132,
  qrBoxInset: 56,
  qrFrameInset: 8,
  sourceIconOffsetX: 12,
  sourceIconOffsetY: 14,
  sourceTextOffsetX: 30,
  sourceTextOffsetY: 20,
  sourceLineHeight: 34,
  sourceMaxLines: 4,
  minSourceWidth: 300,
  sourceGapToQr: 24,
  canvasBottomPadding: 70
}

export const computeShareImageLayout = ({
  introLineCount = 0,
  quoteLineCount = 0,
  authorLineCount = 0,
  sourceLineCount = 1
} = {}) => {
  const dims = SHARE_IMAGE_DIMENSIONS
  const safeIntroLineCount = Math.max(0, introLineCount)
  const safeQuoteLineCount = Math.max(1, quoteLineCount)
  const safeAuthorLineCount = Math.max(0, authorLineCount)
  const safeSourceLineCount = Math.min(
    dims.sourceMaxLines,
    Math.max(1, sourceLineCount)
  )

  let contentHeight = dims.cardPaddingTop + dims.introTopGap

  if (safeIntroLineCount) {
    contentHeight += safeIntroLineCount * dims.introLineHeight + dims.introGapAfter
  }

  contentHeight += safeQuoteLineCount * dims.quoteLineHeight
  contentHeight += dims.dividerGapBefore + dims.dividerGapAfter

  if (safeAuthorLineCount) {
    contentHeight += safeAuthorLineCount * dims.authorLineHeight + dims.sectionGapAfterAuthor
  }

  const qrBlockHeight = dims.qrSize
  const sourceBlockHeight = (safeSourceLineCount - 1) * dims.sourceLineHeight + dims.sourceTextOffsetY
  const footerHeight = Math.max(qrBlockHeight, sourceBlockHeight) + dims.cardPaddingBottom

  const cardHeight = Math.max(contentHeight + footerHeight, 1040)
  const canvasHeight = dims.cardY + cardHeight + dims.canvasBottomPadding

  return {
    cardHeight,
    canvasHeight,
    qrBoxY: dims.cardY + cardHeight - dims.qrBoxInset - dims.qrSize,
    sourceLineCount: safeSourceLineCount
  }
}
