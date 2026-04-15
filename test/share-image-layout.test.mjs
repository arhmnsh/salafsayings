import test from 'node:test'
import assert from 'node:assert/strict'

import { computeShareImageLayout, SHARE_IMAGE_DIMENSIONS } from '../app/utils/share-image.js'

test('keeps the existing minimum share image height for short sayings', () => {
  const layout = computeShareImageLayout({
    introLineCount: 2,
    quoteLineCount: 3,
    authorLineCount: 1,
    sourceLineCount: 2
  })

  assert.equal(layout.cardHeight, 1040)
  assert.equal(
    layout.canvasHeight,
    SHARE_IMAGE_DIMENSIONS.cardY + 1040 + SHARE_IMAGE_DIMENSIONS.canvasBottomPadding
  )
})

test('grows the card height for long quotes instead of truncating them', () => {
  const layout = computeShareImageLayout({
    introLineCount: 1,
    quoteLineCount: 24,
    authorLineCount: 1,
    sourceLineCount: 3
  })

  assert.ok(layout.cardHeight > 1800)
  assert.ok(layout.canvasHeight > 1900)
})

test('accounts for long intros and multi-line author blocks', () => {
  const layout = computeShareImageLayout({
    introLineCount: 14,
    quoteLineCount: 8,
    authorLineCount: 2,
    sourceLineCount: 4
  })

  assert.ok(layout.cardHeight > 1600)
  assert.ok(layout.qrBoxY + SHARE_IMAGE_DIMENSIONS.qrSize <= SHARE_IMAGE_DIMENSIONS.cardY + layout.cardHeight - SHARE_IMAGE_DIMENSIONS.cardPaddingBottom)
})

test('caps footer source layout to supported max line count', () => {
  const layout = computeShareImageLayout({
    introLineCount: 0,
    quoteLineCount: 6,
    authorLineCount: 0,
    sourceLineCount: 12
  })

  assert.equal(layout.sourceLineCount, SHARE_IMAGE_DIMENSIONS.sourceMaxLines)
})
