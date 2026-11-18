// Herramienta de autoría: usa Playwright externo solo para decodificar el MP3.
// Uso: node scripts/preparar-sampleos.mjs <ruta-playwright-index.mjs> <navegador.exe>
import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const [modulo, executablePath] = process.argv.slice(2)
if (!modulo || !executablePath) throw new Error('Indica la ruta de Playwright y de Chrome/Chromium.')
const { chromium } = await import(pathToFileURL(modulo).href)
const source = await fs.readFile(new URL('../src/assets/samples/source/C4.mp3', import.meta.url))
const browser = await chromium.launch({ executablePath, headless: true })
let pcm
try {
  const page = await browser.newPage()
  pcm = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const context = new OfflineAudioContext(1, 1, 24000)
    const audio = await context.decodeAudioData(bytes.buffer)
    return { sampleRate: audio.sampleRate, data: Array.from(audio.getChannelData(0)) }
  }, source.toString('base64'))
} finally { await browser.close() }

const rate = 24000, duration = 1.5
const patterns = { relacion: [0, 4, 7, 4], seleccion: [4, 2, 0, 2], proyeccion: [7, 9, 7, 0], 'proyeccion-extendida': [9, 7, 4, 2], join: [0, 7, 4, 0] }
const manifest = { fuente: 'Salamander Grand Piano, Alexander Holm', licencia: 'CC BY 3.0', origen: 'https://tonejs.github.io/audio/salamander/C4.mp3', sha256Fuente: createHash('sha256').update(source).digest('hex'), adaptacion: 'Remuestreo lineal de piano grabado; cuatro notas en Do pentatónica, ataques cada 0.25 s, envolventes y normalización. Sin osciladores.', muestras: [] }
for (const [name, pattern] of Object.entries(patterns)) {
  const output = new Float64Array(rate * duration)
  for (const [note, semitone] of pattern.entries()) {
    const ratio = 2 ** (semitone / 12), start = Math.round(note * 0.25 * rate)
    const length = Math.min(Math.round(0.75 * rate), output.length - start)
    for (let i = 0; i < length; i++) {
      const offset = i * ratio * pcm.sampleRate / rate
      const floor = Math.floor(offset), fraction = offset - floor
      const value = (pcm.data[floor] ?? 0) * (1 - fraction) + (pcm.data[floor + 1] ?? 0) * fraction
      const envelope = Math.min(1, i / (rate * 0.008), (length - 1 - i) / (rate * 0.15))
      output[start + i] += value * envelope
    }
  }
  const peak = output.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
  const wav = Buffer.alloc(44 + output.length * 2)
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(output.length * 2, 40)
  for (let i = 0; i < output.length; i++) wav.writeInt16LE(Math.round(output[i] / peak * 0.65 * 32767), 44 + i * 2)
  await fs.writeFile(new URL(`../src/assets/samples/${name}.wav`, import.meta.url), wav)
  manifest.muestras.push({ archivo: `${name}.wav`, semitonosDesdeC4: pattern, duracion: duration, sampleRate: rate, picoMaximo: 0.65, sha256: createHash('sha256').update(wav).digest('hex') })
}
await fs.writeFile(new URL('../src/assets/samples/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
console.log('Cinco fragmentos WAV creados a partir del sample de piano grabado.')
