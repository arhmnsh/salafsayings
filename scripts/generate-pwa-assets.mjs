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
  let r = Math.round(7 + 8 * nx)
  let g = Math.round(11 + 16 * nx + 5 * ny)
  let b = Math.round(24 + 28 * nx + 10 * ny)

  const glowA = clamp(1 - Math.hypot(x - width * 0.2, y - height * 0.16) / (width * 0.32), 0, 1)
  const glowB = clamp(1 - Math.hypot(x - width * 0.88, y - height * 0.86) / (width * 0.4), 0, 1)
  r += Math.round(glowA * 72 + glowB * 18)
  g += Math.round(glowA * 36 + glowB * 78)
  b += Math.round(glowA * 10 + glowB * 94)

  const panelLeft = width * 0.18
  const panelRight = width * 0.82
  const panelTop = height * 0.18
  const panelBottom = height * 0.82
  const centerX = width * 0.5
  const apexY = height * 0.12

  const inBody =
    x >= panelLeft &&
    x <= panelRight &&
    y >= panelTop + height * 0.07 &&
    y <= panelBottom

  const roofSlope = (panelTop + height * 0.07 - apexY) / (panelLeft - centerX)
  const roofY = apexY + roofSlope * Math.abs(x - centerX)
  const inRoof = x >= panelLeft && x <= panelRight && y >= roofY && y <= panelTop + height * 0.07
  const inPanel = inBody || inRoof

  if (inPanel) {
    r = Math.round(r * 0.68 + 18)
    g = Math.round(g * 0.72 + 24)
    b = Math.round(b * 0.8 + 38)
  }

  const panelBorder =
    (Math.abs(y - roofY) < width * 0.012 && x >= panelLeft && x <= panelRight && y <= panelTop + height * 0.07) ||
    (Math.abs(x - panelLeft) < width * 0.012 && y >= panelTop + height * 0.07 && y <= panelBottom) ||
    (Math.abs(x - panelRight) < width * 0.012 && y >= panelTop + height * 0.07 && y <= panelBottom) ||
    (Math.abs(y - panelBottom) < width * 0.012 && x >= panelLeft && x <= panelRight)

  if (panelBorder) {
    r = 222
    g = 232
    b = 255
  }

  const isInsideEllipse = (cx, cy, rx, ry) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1
  }

  const isInsideArabicQuote = (cx, cy, scale, mirror = false) => {
    const dot = isInsideEllipse(cx + (mirror ? scale * 0.12 : -scale * 0.12), cy + scale * 0.3, scale * 0.11, scale * 0.11)
    const main = isInsideEllipse(cx, cy, scale * 0.22, scale * 0.28)
    const cutout = isInsideEllipse(cx + (mirror ? -scale * 0.08 : scale * 0.08), cy - scale * 0.02, scale * 0.14, scale * 0.16)
    const stem =
      x >= cx - scale * 0.12 &&
      x <= cx + scale * 0.02 &&
      y >= cy + scale * 0.06 &&
      y <= cy + scale * 0.42

    return dot || ((main && !cutout) || stem)
  }

  if (isInsideArabicQuote(width * 0.39, height * 0.42, width * 0.22, false) || isInsideArabicQuote(width * 0.61, height * 0.42, width * 0.22, true)) {
    r = 247
    g = 210
    b = 96
  }

  const dividerY = height * 0.73
  if (y > dividerY && y < dividerY + height * 0.028 && x > width * 0.28 && x < width * 0.72) {
    r = 223
    g = 232
    b = 255
  }

  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 255]
}

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Salaf Sayings">
  <defs>
    <linearGradient id="bg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#070B18"/>
      <stop offset="0.58" stop-color="#0D1731"/>
      <stop offset="1" stop-color="#0A1224"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <circle cx="20" cy="20" r="12" fill="#F59E0B" fill-opacity="0.3"/>
  <circle cx="54" cy="56" r="18" fill="#38BDF8" fill-opacity="0.26"/>
  <path d="M16 49V23.5L32 10l16 13.5V49" fill="#15213E" fill-opacity="0.9" stroke="#DDE8FF" stroke-opacity="0.75" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M24.5 24.5c0-4.4 3.1-7.2 7.3-7.2 0 2.7 0 2.7-.1 2.7-2.2 0-3.6 1.2-3.6 3.7v4.8h-4.6v-4z" fill="#FCD34D"/>
  <circle cx="26.2" cy="31.4" r="1.65" fill="#FCD34D"/>
  <path d="M39.5 24.5c0-4.4-3.1-7.2-7.3-7.2 0 2.7 0 2.7.1 2.7 2.2 0 3.6 1.2 3.6 3.7v4.8h4.6v-4z" fill="#FCD34D"/>
  <circle cx="37.8" cy="31.4" r="1.65" fill="#FCD34D"/>
  <rect x="21" y="39.5" width="22" height="2.8" rx="1.4" fill="#DDE8FF" fill-opacity="0.92"/>
</svg>`

fs.mkdirSync(publicDir, { recursive: true })
writePng(path.join(publicDir, 'icon-192.png'), 192, 192, createRenderer())
writePng(path.join(publicDir, 'icon-512.png'), 512, 512, createRenderer())
writePng(path.join(publicDir, 'apple-touch-icon.png'), 180, 180, createRenderer())
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)

console.log('Generated PWA icons and favicon in public/')
