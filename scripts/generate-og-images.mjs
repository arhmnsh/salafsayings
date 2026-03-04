import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SITE = 'https://salafsayings.arhmn.sh'
const WIDTH = 1200
const HEIGHT = 630

const sayingsPath = path.join(ROOT, 'content', 'salafsayings.json')
const outDir = path.join(ROOT, 'public', 'og')

const sayings = JSON.parse(fs.readFileSync(sayingsPath, 'utf8'))

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const squeeze = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const wrapText = (value, maxCharsPerLine, maxLines) => {
  const text = squeeze(value)
  if (!text) return []
  const words = text.split(' ')
  const lines = []
  let line = ''

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (trial.length <= maxCharsPerLine) {
      line = trial
      continue
    }
    if (line) {
      lines.push(line)
      line = word
    } else {
      lines.push(word.slice(0, maxCharsPerLine))
      line = word.slice(maxCharsPerLine)
    }
    if (lines.length === maxLines) break
  }

  if (lines.length < maxLines && line) lines.push(line)

  if (words.length && lines.join(' ').length < text.length && lines.length) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`
  }

  return lines.slice(0, maxLines)
}

const linesToTspans = (lines, x, startY, lineHeight) =>
  lines
    .map((line, index) => `<tspan x="${x}" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')

const baseSvg = (content) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Salaf Sayings social preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#070B18"/>
      <stop offset="0.52" stop-color="#0D1731"/>
      <stop offset="1" stop-color="#091224"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 86) rotate(33) scale(290 250)">
      <stop stop-color="#F59E0B" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1060 590) rotate(32) scale(380 300)">
      <stop stop-color="#38BDF8" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#38BDF8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowA)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowB)"/>
  <rect x="58" y="54" width="1084" height="522" rx="30" fill="#0E1A36" fill-opacity="0.78" stroke="#FFFFFF" stroke-opacity="0.2"/>

  ${content}
</svg>`

const renderAppOgSvg = () => {
  const titleLines = wrapText('Salaf Sayings', 22, 1)
  const subtitleLines = wrapText('A focused collection of concise reminders from the Salaf, designed for reflection.', 47, 3)

  return baseSvg(`
  <text x="106" y="120" fill="#FCD34D" font-size="27" font-family="Inter, Segoe UI, Arial, sans-serif" letter-spacing="4.7">SALAF SAYINGS</text>
  <text x="106" y="240" fill="#F8FAFC" font-size="86" font-family="Georgia, Times New Roman, serif" font-weight="600">${linesToTspans(titleLines, 106, 240, 88)}</text>
  <text x="106" y="316" fill="#DDE8FF" fill-opacity="0.95" font-size="42" font-family="Georgia, Times New Roman, serif">${linesToTspans(subtitleLines, 106, 316, 58)}</text>
  <line x1="106" y1="470" x2="1094" y2="470" stroke="#FFFFFF" stroke-opacity="0.23"/>
  <text x="106" y="528" fill="#FDE68A" font-size="32" font-family="Inter, Segoe UI, Arial, sans-serif">${escapeXml(SITE)}</text>
  `)
}

const renderQuoteOgSvg = (saying) => {
  const introLines = wrapText(saying.intro || '', 68, 2)
  const quoteLines = wrapText(`“${saying.quote}”`, 47, 6)
  const authorLine = squeeze(saying.author || 'Salaf Sayings')
  const footer = `${SITE}/${saying.id}`

  return baseSvg(`
  <text x="106" y="114" fill="#FCD34D" font-size="25" font-family="Inter, Segoe UI, Arial, sans-serif" letter-spacing="4.4">SALAF SAYINGS</text>
  ${introLines.length ? `<text x="106" y="165" fill="#CFDCF6" fill-opacity="0.86" font-size="27" font-family="Inter, Segoe UI, Arial, sans-serif">${linesToTspans(introLines, 106, 165, 35)}</text>` : ''}
  <text x="106" y="${introLines.length ? 252 : 218}" fill="#F8FAFC" font-size="52" font-family="Georgia, Times New Roman, serif">${linesToTspans(quoteLines, 106, introLines.length ? 252 : 218, 66)}</text>
  <line x1="106" y1="470" x2="1094" y2="470" stroke="#FFFFFF" stroke-opacity="0.23"/>
  <text x="106" y="523" fill="#FDE68A" font-size="31" font-family="Inter, Segoe UI, Arial, sans-serif" letter-spacing="0.6">${escapeXml(authorLine.toUpperCase())}</text>
  <text x="106" y="558" fill="#D5E2FF" fill-opacity="0.9" font-size="22" font-family="Inter, Segoe UI, Arial, sans-serif">${escapeXml(footer)}</text>
  `)
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'app.svg'), renderAppOgSvg())

for (const saying of sayings) {
  const id = String(saying.id || '').trim()
  if (!id) continue
  fs.writeFileSync(path.join(outDir, `${id}.svg`), renderQuoteOgSvg(saying))
}

console.log(`Generated OG SVGs in ${path.relative(ROOT, outDir)} (${sayings.length + 1} files)`)
