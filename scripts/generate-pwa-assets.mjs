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
  let r = 16
  let g = 24
  let b = 39

  const gold = [197, 163, 88]
  const bronze = [122, 92, 46]

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

  const innerPad = width * 0.03
  if (!isInsideRoundedRect(innerPad, innerPad, width - innerPad, height - innerPad, width * 0.18)) {
    return [0, 0, 0, 0]
  }

  if (drawCorner('top-right') || drawCorner('bottom-left')) {
    return [bronze[0], bronze[1], bronze[2], 255]
  }

  const leftOuter = drawRoundedLine(width * 0.381, height * 0.342, width * 0.381, height * 0.489, width * 0.02)
  const leftInner = drawRoundedLine(width * 0.42, height * 0.352, width * 0.42, height * 0.489, width * 0.02)
  const rightOuter = drawRoundedLine(width * 0.615, height * 0.401, width * 0.615, height * 0.576, width * 0.02)
  const rightInner = drawRoundedLine(width * 0.576, height * 0.411, width * 0.576, height * 0.557, width * 0.02)

  if (leftOuter || leftInner || rightOuter || rightInner) {
    return [gold[0], gold[1], gold[2], 255]
  }

  const underlineA = drawRoundedLine(width * 0.4, height * 0.625, width * 0.6, height * 0.625, width * 0.016)
  const underlineB = drawRoundedLine(width * 0.43, height * 0.66, width * 0.57, height * 0.66, width * 0.012)
  if (underlineA || underlineB) {
    return underlineA ? [gold[0], gold[1], gold[2], 255] : [bronze[0], bronze[1], bronze[2], 255]
  }

  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 255]
}

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Salaf Sayings">
  <rect width="64" height="64" rx="15" fill="#101827"/>
  <path d="M46.875 8.75H51.875C52.9105 8.75 53.75 9.58947 53.75 10.625V15.625" stroke="#7A5C2E" stroke-width="0.75" stroke-linecap="round"/>
  <path d="M17.125 55.25H12.125C11.0895 55.25 10.25 54.4105 10.25 53.375V48.375" stroke="#7A5C2E" stroke-width="0.75" stroke-linecap="round"/>
  <g transform="translate(24.375, 21.875)">
    <path d="M1.875 0C0.839466 0 0 0.839466 0 1.875V9.375M6.875 0.625C5.83947 0.625 5 1.46447 5 2.5V9.375" stroke="#C5A358" stroke-width="0.625" stroke-linecap="round"/>
    <path d="M13.125 13.125C14.1605 13.125 15 12.2855 15 11.25V3.75M10.625 12.5C11.6605 12.5 12.5 11.6605 12.5 10.625V3.75" stroke="#C5A358" stroke-width="0.625" stroke-linecap="round"/>
  </g>
  <line x1="25.625" y1="40" x2="38.375" y2="40" stroke="#C5A358" stroke-width="0.5" stroke-linecap="round"/>
  <line x1="27.5" y1="42.25" x2="36.5" y2="42.25" stroke="#7A5C2E" stroke-width="0.375" stroke-linecap="round"/>
</svg>`

fs.mkdirSync(publicDir, { recursive: true })
writePng(path.join(publicDir, 'icon-192.png'), 192, 192, createRenderer())
writePng(path.join(publicDir, 'icon-512.png'), 512, 512, createRenderer())
writePng(path.join(publicDir, 'apple-touch-icon.png'), 180, 180, createRenderer())
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)

console.log('Generated PWA icons and favicon in public/')
