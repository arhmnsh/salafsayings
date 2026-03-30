import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const publicDir = path.join(root, 'public')

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer) => {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const pngChunk = (type, payload) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(payload.length, 0)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, payload])), 0)
  return Buffer.concat([len, name, payload, crc])
}

const writePng = (filePath, width, height, drawPixel) => {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1)
    raw[rowOffset] = 0
    for (let x = 0; x < width; x++) {
      const pixel = drawPixel(x, y, width, height)
      const offset = rowOffset + 1 + x * 4
      raw[offset] = pixel[0]
      raw[offset + 1] = pixel[1]
      raw[offset + 2] = pixel[2]
      raw[offset + 3] = pixel[3]
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])

  fs.writeFileSync(filePath, png)
}

const createRenderer = () => (x, y, width, height) => {
  const nx = x / (width - 1)
  const ny = y / (height - 1)

  let r = Math.round(24 + 8 * nx)
  let g = Math.round(35 + 10 * ny)
  let b = Math.round(60 + 18 * nx + 8 * ny)

  const vignette = clamp(1 - Math.hypot(nx - 0.5, ny - 0.5) / 0.78, 0, 1)
  r += Math.round(vignette * 5)
  g += Math.round(vignette * 6)
  b += Math.round(vignette * 10)

  const gold = [212, 168, 52]
  const grid = [76, 91, 123]

  const isInsideRoundedRect = (left, top, right, bottom, radius) => {
    if (x < left || x > right || y < top || y > bottom) return false
    if (x >= left + radius && x <= right - radius) return true
    if (y >= top + radius && y <= bottom - radius) return true

    const cx = x < left + radius ? left + radius : right - radius
    const cy = y < top + radius ? top + radius : bottom - radius
    return Math.hypot(x - cx, y - cy) <= radius
  }

  const drawRoundedLine = (x1, y1, x2, y2, thickness) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / lengthSq, 0, 1)
    const px = x1 + t * dx
    const py = y1 + t * dy
    return Math.hypot(x - px, y - py) <= thickness / 2
  }

  const isInsideEllipse = (cx, cy, rx, ry) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1
  }

  const drawCorner = (corner) => {
    const inset = width * 0.095
    const arm = width * 0.12
    const radius = width * 0.035
    const stroke = width * 0.008

    if (corner === 'top-right') {
      return (
        drawRoundedLine(width - inset - arm, inset, width - inset - radius, inset, stroke) ||
        drawRoundedLine(width - inset, inset + radius, width - inset, inset + arm, stroke) ||
        (Math.hypot(x - (width - inset - radius), y - (inset + radius)) <= radius + stroke / 2 &&
          Math.hypot(x - (width - inset - radius), y - (inset + radius)) >= radius - stroke / 2 &&
          x >= width - inset - radius &&
          y <= inset + radius)
      )
    }

    return (
      drawRoundedLine(inset, height - inset - arm, inset, height - inset - radius, stroke) ||
      drawRoundedLine(inset + radius, height - inset, inset + arm, height - inset, stroke) ||
      (Math.hypot(x - (inset + radius), y - (height - inset - radius)) <= radius + stroke / 2 &&
        Math.hypot(x - (inset + radius), y - (height - inset - radius)) >= radius - stroke / 2 &&
        x <= inset + radius &&
        y >= height - inset - radius)
    )
  }

  const drawArabicQuote = (cx, cy, mirrored = false) => {
    const scale = width * 0.154
    const gap = scale * 0.16
    const thickness = width * 0.018
    const lift = scale * 0.9
    const arcRadius = scale * 0.34
    const dir = mirrored ? -1 : 1

    const stemA = drawRoundedLine(cx - gap * dir, cy - lift * 0.65, cx - gap * dir, cy + lift * 0.1, thickness)
    const stemB = drawRoundedLine(cx + gap * dir, cy - lift * 0.58, cx + gap * dir, cy + lift * 0.06, thickness)
    const arcA = isInsideEllipse(cx - gap * dir + arcRadius * dir * 0.02, cy + lift * 0.07, arcRadius, arcRadius * 1.1) &&
      !isInsideEllipse(cx - gap * dir + arcRadius * dir * 0.16, cy + lift * 0.01, arcRadius * 0.78, arcRadius * 0.84) &&
      (mirrored ? x <= cx - gap * dir + arcRadius * 0.42 : x >= cx - gap * dir - arcRadius * 0.42)
    const arcB = isInsideEllipse(cx + gap * dir + arcRadius * dir * 0.02, cy + lift * 0.03, arcRadius, arcRadius * 1.08) &&
      !isInsideEllipse(cx + gap * dir + arcRadius * dir * 0.16, cy - lift * 0.02, arcRadius * 0.78, arcRadius * 0.84) &&
      (mirrored ? x <= cx + gap * dir + arcRadius * 0.42 : x >= cx + gap * dir - arcRadius * 0.42)

    return stemA || stemB || arcA || arcB
  }

  const innerPad = width * 0.03
  if (!isInsideRoundedRect(innerPad, innerPad, width - innerPad, height - innerPad, width * 0.18)) {
    return [0, 0, 0, 0]
  }

  const gridSpacing = width * 0.125
  const dotRadius = width * 0.0036
  const gx = Math.round((x - width * 0.04) / gridSpacing) * gridSpacing + width * 0.04
  const gy = Math.round((y - height * 0.04) / gridSpacing) * gridSpacing + height * 0.04
  if (Math.hypot(x - gx, y - gy) <= dotRadius) {
    r = Math.round(r * 0.85 + grid[0] * 0.15)
    g = Math.round(g * 0.84 + grid[1] * 0.16)
    b = Math.round(b * 0.82 + grid[2] * 0.18)
  }

  if (drawCorner('top-right') || drawCorner('bottom-left')) {
    return [gold[0], gold[1], gold[2], 255]
  }

  if (drawArabicQuote(width * 0.42, height * 0.44, false) || drawArabicQuote(width * 0.58, height * 0.44, true)) {
    return [gold[0], gold[1], gold[2], 255]
  }

  const underlineA = drawRoundedLine(width * 0.39, height * 0.635, width * 0.63, height * 0.635, width * 0.01)
  const underlineB = drawRoundedLine(width * 0.42, height * 0.675, width * 0.6, height * 0.675, width * 0.01)
  if (underlineA || underlineB) {
    return [gold[0], gold[1], gold[2], 255]
  }

  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 255]
}

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Salaf Sayings">
  <defs>
    <linearGradient id="bg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1B2740"/>
      <stop offset="1" stop-color="#202D49"/>
    </linearGradient>
    <pattern id="dots" width="7.5" height="7.5" patternUnits="userSpaceOnUse">
      <circle cx="3.75" cy="3.75" r="0.34" fill="#53647F" fill-opacity="0.42"/>
    </pattern>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <rect width="64" height="64" rx="16" fill="url(#dots)"/>
  <g fill="none" stroke="#C99B2E" stroke-width="1.25" stroke-linecap="round">
    <path d="M47 6h5.5c2 0 3.5 1.5 3.5 3.5V15"/>
    <path d="M8 49v5.5C8 56.5 9.5 58 11.5 58H17"/>
  </g>
  <g stroke="#D1A732" stroke-width="1.35" stroke-linecap="round" fill="none">
    <path d="M23.5 21.5v9.2"/>
    <path d="M24.6 21.5c2.5 0 4 1.6 4 4.1"/>
    <path d="M24.6 30.4c2.7 0 4.2-1.7 4.2-4.4"/>
    <path d="M39.4 21.5v9.2"/>
    <path d="M37.9 30.5c2.8 0 4.3-1.8 4.3-4.6"/>
    <path d="M38.2 30.5c2.2 0 3.5-1.4 3.5-4"/>
  </g>
  <g stroke="#C99B2E" stroke-width="1" stroke-linecap="round">
    <path d="M22.5 40h17"/>
    <path d="M24.5 42.5h13"/>
  </g>
</svg>`

fs.mkdirSync(publicDir, { recursive: true })
writePng(path.join(publicDir, 'icon-192.png'), 192, 192, createRenderer())
writePng(path.join(publicDir, 'icon-512.png'), 512, 512, createRenderer())
writePng(path.join(publicDir, 'apple-touch-icon.png'), 180, 180, createRenderer())
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)

console.log('Generated PWA icons and favicon in public/')
