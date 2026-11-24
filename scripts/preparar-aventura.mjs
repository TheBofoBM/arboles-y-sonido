// Autoría reproducible. node scripts/preparar-aventura.mjs <playwright/index.mjs> <chrome.exe>
import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { MOTIVOS, midiPentatonico, nombreRegistro, DURACION_MOTIVO, DURACION_BASE } from '../src/modules/sonification/music.js'

const [modulo, executablePath] = process.argv.slice(2)
if (!modulo || !executablePath) throw new Error('Indica Playwright externo y Chrome.')
const destino = new URL('../src/assets/samples/aventura/', import.meta.url)
const vsco = '440300901dfe9275fd84e0b7763af1f8443ae62e', vcsl = 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'
const fuentes = {
  cuerdas: { repo: 'VSCO-2-CE', revision: vsco, ruta: 'Strings/Violin Section/Spic/VlnEns_Spic_C4_v1_rr1.wav', midi: 72 },
  flauta: { repo: 'VSCO-2-CE', revision: vsco, ruta: 'Woodwinds/Flute/stac/LDFlute_stac_C4_v1_rr1.wav', midi: 72 },
  trompa: { repo: 'VSCO-2-CE', revision: vsco, ruta: 'Brass/F Horn/stac/MOHorn_stac_C3_v2_rr1.wav', midi: 60 },
  cello: { repo: 'VSCO-2-CE', revision: vsco, ruta: 'Strings/Cello Section/pizzT/pizzT_C3_v1_RR1.wav', midi: 60 },
  campanas: { repo: 'VCSL', revision: vcsl, ruta: 'Idiophones/Struck Idiophones/Glockenspiel/glock_soft_C5_02.wav', midi: 72 },
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
await fs.mkdir(new URL('source/', destino), { recursive: true })
const descargas = await Promise.allSettled(Object.entries(fuentes).map(async ([id, f]) => {
  f.url = `https://raw.githubusercontent.com/sgossner/${f.repo}/${f.revision}/` + f.ruta.split('/').map(encodeURIComponent).join('/')
  let bytes
  try { bytes = await fs.readFile(new URL(`source/${id}.wav`, destino)) } catch {
    const respuesta = await fetch(f.url)
    if (!respuesta.ok) throw new Error(`${id}: HTTP ${respuesta.status}`)
    bytes = Buffer.from(await respuesta.arrayBuffer())
    await fs.writeFile(new URL(`source/${id}.wav`, destino), bytes)
  }
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
  f.sha256 = sha(bytes)
  return [id, bytes.toString('base64')]
}))
const fallos = descargas.filter(r => r.status === 'rejected')
if (fallos.length) throw new AggregateError(fallos.map(r => r.reason), 'Falló el banco orquestal')
for (const [repo, revision] of [['VSCO-2-CE', vsco], ['VCSL', vcsl]]) {
  const licencia = await fetch(`https://raw.githubusercontent.com/sgossner/${repo}/${revision}/LICENSE`)
  if (!licencia.ok) throw new Error('No se pudo obtener la licencia de ' + repo)
  await fs.writeFile(new URL(`source/LICENSE-${repo}.txt`, destino), await licencia.text())
}
const { chromium } = await import(pathToFileURL(modulo).href)
const browser = await chromium.launch({ executablePath, headless: true })
let grabaciones
try {
  const page = await browser.newPage()
  grabaciones = await page.evaluate(async entradas => {
    const context = new OfflineAudioContext(1, 1, 24000), resultado = {}
    for (const [id, base64] of entradas) {
      const audio = await context.decodeAudioData(Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer)
      const mono = new Float32Array(audio.length)
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const canal = audio.getChannelData(c)
        for (let i = 0; i < mono.length; i++) mono[i] += canal[i] / audio.numberOfChannels
      }
      resultado[id] = Array.from(mono)
    }
    return resultado
  }, descargas.map(r => r.value))
} finally { await browser.close() }

const rate = 24000
for (const [id, data] of Object.entries(grabaciones)) {
  const pico = data.reduce((p, v) => Math.max(p, Math.abs(v)), 0)
  const inicio = Math.max(0, data.findIndex(v => Math.abs(v) > pico * .02) - 48)
  grabaciones[id] = data.slice(inicio).map(v => v / pico)
  fuentes[id].recorteSegundos = inicio / rate
}
function nota(salida, id, midi, inicio, duracion, volumen = 1) {
  const fuente = grabaciones[id], ratio = 2 ** ((midi - fuentes[id].midi) / 12)
  const comienzo = Math.round(inicio * rate), largo = Math.round(duracion * rate)
  for (let i = 0; i < largo && comienzo + i < salida.length; i++) {
    const offset = i * ratio, j = Math.floor(offset), f = offset - j
    const valor = (fuente[j] ?? 0) * (1 - f) + (fuente[j + 1] ?? 0) * f
    const env = Math.max(0, Math.min(1, i / (rate * .008), (largo - 1 - i) / (rate * .12)))
    salida[comienzo + i] += valor * env * volumen
  }
}
function sala(pcm) {
  const original = pcm.slice()
  for (const [retardo, ganancia] of [[.073, .17], [.139, .11], [.227, .07]]) {
    const d = Math.round(retardo * rate)
    for (let i = d; i < pcm.length; i++) pcm[i] += original[i - d] * ganancia
  }
}
function normalizar(pcm, pico) {
  // Extremos suaves tanto en los motivos como en el bucle.
  for (let i = 0; i < pcm.length; i++) pcm[i] *= Math.max(0, Math.min(1, i / 192, (pcm.length - 1 - i) / 480))
  const max = pcm.reduce((p, v) => Math.max(p, Math.abs(v)), 0)
  assert(max > 0)
  for (let i = 0; i < pcm.length; i++) pcm[i] *= pico / max
}
function wav(pcm) {
  const bytes = Buffer.alloc(44 + pcm.length * 2)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(pcm.length * 2, 40)
  for (let i = 0; i < pcm.length; i++) {
    assert(Number.isFinite(pcm[i]) && Math.abs(pcm[i]) <= 1)
    bytes.writeInt16LE(Math.round(pcm[i] * 32767), 44 + i * 2)
  }
  return bytes
}
const manifest = {
  nombre: 'Aventura orbital', licencia: 'CC0-1.0 (grabaciones)',
  descripcion: 'Motivos originales de aventura espacial: cuerdas, flauta, trompa y campanas; pulso de 6/8. Sin melodías ni audio extraídos de videojuegos.',
  fuentes, afinacion: 'G mayor pentatónica; referencia MIDI según los mapas SFZ de VSCO (C4 del archivo = MIDI 72).',
  duracionMotivo: DURACION_MOTIVO, intervaloNodo: 1.5, muestras: [],
}
const fragmentos = {}
for (const [tipo, motivo] of Object.entries(MOTIVOS)) {
  for (let registro = 0; registro <= 10; registro++) {
    const pcm = new Float64Array(rate * DURACION_MOTIVO)
    motivo.grados.forEach((grado, i) => {
      const midi = midiPentatonico(registro + grado), inicio = motivo.tiempos[i]
      nota(pcm, motivo.instrumento, midi, inicio, i === motivo.grados.length - 1 ? .7 : .42, i % 3 === 0 ? 1 : .82)
      if (tipo === 'JOIN') nota(pcm, 'cuerdas', midi - 12, inicio, .38, .32)
      if (tipo === 'PROYECCION_EXTENDIDA') nota(pcm, 'cuerdas', midi - 12, inicio, .4, .32)
    })
    sala(pcm); normalizar(pcm, .6)
    const id = `${motivo.id}-${registro}`, bytes = wav(pcm)
    await fs.writeFile(new URL(`${id}.wav`, destino), bytes)
    fragmentos[id] = pcm
    manifest.muestras.push({ archivo: `${id}.wav`, tipo, registro, notaReferencia: nombreRegistro(registro), midiReferencia: midiPentatonico(registro), duracion: DURACION_MOTIVO, pico: .6, sha256: sha(bytes) })
  }
}
const base = new Float64Array(rate * DURACION_BASE)
for (let compas = 0; compas < 4; compas++) {
  const inicio = compas * 1.5
  nota(base, 'cello', compas % 2 ? 50 : 43, inicio, .65, .9)
  nota(base, 'cello', 50, inicio + .75, .65, .65)
  for (let pulso = 0; pulso < 6; pulso++) {
    const midi = [67, 71, 74, 76, 74, 71][(pulso + compas * 2) % 6]
    nota(base, 'cuerdas', midi, inicio + pulso * .25, .24, .3)
  }
  nota(base, 'campanas', 86, inicio + 1.25, .25, .1)
}
sala(base); normalizar(base, .5)
const baseWav = wav(base)
await fs.writeFile(new URL('base.wav', destino), baseWav)
manifest.base = { archivo: 'base.wav', duracion: DURACION_BASE, pico: .5, sha256: sha(baseWav) }
await fs.writeFile(new URL('manifest.json', destino), JSON.stringify(manifest, null, 2) + '\n')

// Demo de biblioteca en postorden con el mapeo predeterminado.
const recorrido = [['relacion', 7], ['relacion', 7], ['join', 8], ['seleccion', 9], ['proyeccion', 10]]
const demo = new Float64Array(rate * 8)
for (let i = 0; i < demo.length; i++) {
  const fade = Math.min(1, i / (rate * .08), (demo.length - 1 - i) / (rate * .3))
  demo[i] = base[i % base.length] * .22 * .35 * Math.max(0, fade)
}
recorrido.forEach(([motivo, registro], n) => {
  const pcm = fragmentos[`${motivo}-${registro}`]
  for (let i = 0; i < pcm.length; i++) demo[n * rate * 1.5 + i] += pcm[i] * .35
})
const demoDestino = new URL('../docs/audio-propuestas/aventura-orbital/', import.meta.url)
await fs.mkdir(demoDestino, { recursive: true })
await fs.writeFile(new URL('biblioteca-postorden.wav', demoDestino), wav(demo))
console.log(JSON.stringify({ muestras: manifest.muestras.length, base: manifest.base, demoSegundos: 8, licencia: manifest.licencia }, null, 2))
