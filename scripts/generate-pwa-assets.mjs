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

  const cardLeft = width * 0.17
  const cardTop = height * 0.16
  const cardWidth = width * 0.66
  const cardHeight = height * 0.68
  const radius = width * 0.08

  const dx = Math.max(Math.abs(x - (cardLeft + cardWidth / 2)) - cardWidth / 2 + radius, 0)
  const dy = Math.max(Math.abs(y - (cardTop + cardHeight / 2)) - cardHeight / 2 + radius, 0)
  const inCard = dx * dx + dy * dy <= radius * radius

  if (inCard) {
    r = Math.round(r * 0.72 + 20)
    g = Math.round(g * 0.74 + 22)
    b = Math.round(b * 0.78 + 32)
  }

  const quoteCenters = [
    { x: width * 0.37, y: height * 0.42 },
    { x: width * 0.56, y: height * 0.42 }
  ]

  for (const center of quoteCenters) {
    const d = Math.hypot(x - center.x, y - center.y)
    if (d < width * 0.095) {
      r = 245
      g = 209
      b = 90
    }
    if (x > center.x - width * 0.035 && x < center.x + width * 0.012 && y > center.y && y < center.y + height * 0.16) {
      r = 245
      g = 209
      b = 90
    }
  }

  const footerY = height * 0.76
  if (y > footerY && y < footerY + height * 0.03 && x > width * 0.22 && x < width * 0.78) {
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
  <rect x="12" y="11" width="40" height="42" rx="11" fill="#15213E" fill-opacity="0.88" stroke="rgba(255,255,255,0.22)"/>
  <path d="M25 24c0-3.3 2.5-5.5 6.1-5.5v3.6c-1.6 0-2.4.8-2.4 2.4V31H22v-7z" fill="#FCD34D"/>
  <path d="M39 24c0-3.3 2.5-5.5 6.1-5.5v3.6c-1.6 0-2.4.8-2.4 2.4V31H36v-7z" fill="#FCD34D"/>
  <rect x="18" y="39" width="28" height="3" rx="1.5" fill="#DDE8FF" fill-opacity="0.9"/>
</svg>`

fs.mkdirSync(publicDir, { recursive: true })
writePng(path.join(publicDir, 'icon-192.png'), 192, 192, createRenderer())
writePng(path.join(publicDir, 'icon-512.png'), 512, 512, createRenderer())
writePng(path.join(publicDir, 'apple-touch-icon.png'), 180, 180, createRenderer())
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)

console.log('Generated PWA icons and favicon in public/')
