import test from 'node:test'
import assert from 'node:assert/strict'

import { buildClipboardText, buildQuoteUrl, buildSharePayload, canUseNativeFileShare, canUseNativeShare, copyTextWithFallback, isShareAbortError } from '../app/utils/share.js'

test('buildSharePayload separates text and url', () => {
  const item = {
    id: 2290,
    quote: 'Hold firmly to the Sunnah.',
    author: 'Imam Malik',
    title: 'A Saying'
  }

  assert.deepEqual(buildSharePayload(item), {
    title: 'A Saying',
    text: '"Hold firmly to the Sunnah." — Imam Malik',
    url: 'https://salafsayings.arhmn.sh/2290'
  })
})

test('buildClipboardText includes the public url on a new line', () => {
  const item = {
    slug: 'firmness',
    quote: 'Knowledge before speech and action.'
  }

  assert.equal(
    buildClipboardText(item),
    '"Knowledge before speech and action."\nhttps://salafsayings.arhmn.sh/firmness'
  )
  assert.equal(buildQuoteUrl(item), 'https://salafsayings.arhmn.sh/firmness')
})

test('copyTextWithFallback prefers clipboard api when available', async () => {
  const calls = []
  const navigatorObj = {
    clipboard: {
      writeText: async (value) => {
        calls.push(value)
      }
    }
  }

  const result = await copyTextWithFallback('abc', { navigatorObj })
  assert.equal(result, 'clipboard')
  assert.deepEqual(calls, ['abc'])
})

test('copyTextWithFallback falls back to execCommand copy', async () => {
  let appendedNode = null
  let removed = false
  const textarea = {
    value: '',
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
    remove() {
      removed = true
    }
  }

  const documentObj = {
    body: {
      appendChild(node) {
        appendedNode = node
      }
    },
    createElement(tag) {
      assert.equal(tag, 'textarea')
      return textarea
    },
    execCommand(command) {
      assert.equal(command, 'copy')
      return true
    }
  }

  const result = await copyTextWithFallback('xyz', { navigatorObj: {}, documentObj })
  assert.equal(result, 'execCommand')
  assert.equal(appendedNode, textarea)
  assert.equal(textarea.value, 'xyz')
  assert.equal(removed, true)
})

test('isShareAbortError only matches AbortError', () => {
  assert.equal(isShareAbortError({ name: 'AbortError' }), true)
  assert.equal(isShareAbortError({ name: 'TypeError' }), false)
  assert.equal(isShareAbortError(null), false)
})

test('canUseNativeShare requires secure context or loopback host', () => {
  assert.equal(
    canUseNativeShare({
      navigatorObj: { share() {} },
      isSecureContextValue: true,
      locationObj: { hostname: 'salafsayings.arhmn.sh' }
    }),
    true
  )

  assert.equal(
    canUseNativeShare({
      navigatorObj: { share() {} },
      isSecureContextValue: false,
      locationObj: { hostname: 'localhost' }
    }),
    true
  )

  assert.equal(
    canUseNativeShare({
      navigatorObj: { share() {} },
      isSecureContextValue: false,
      locationObj: { hostname: '169.254.130.244' }
    }),
    false
  )
})

test('canUseNativeFileShare respects native share availability and canShare', () => {
  const file = { name: 'quote.png' }

  assert.equal(
    canUseNativeFileShare([file], {
      navigatorObj: {
        share() {},
        canShare: ({ files }) => files[0] === file
      },
      isSecureContextValue: true,
      locationObj: { hostname: 'salafsayings.arhmn.sh' }
    }),
    true
  )

  assert.equal(
    canUseNativeFileShare([file], {
      navigatorObj: {
        share() {},
        canShare: () => true
      },
      isSecureContextValue: false,
      locationObj: { hostname: '169.254.130.244' }
    }),
    false
  )
})
