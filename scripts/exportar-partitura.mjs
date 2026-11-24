// Exporta la partitura del sample JOIN usado en biblioteca (profundidad 2).
// node scripts/exportar-partitura.mjs <playwright/index.mjs> <chrome.exe>
import fs from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { MOTIVOS, midiPentatonico, INTERVALO_NODO } from '../src/modules/sonification/music.js'

const [modulo, executablePath] = process.argv.slice(2)
if (!modulo || !executablePath) throw new Error('Indica Playwright y Chrome externos.')
const motivo = MOTIVOS.JOIN, registro = 8
const midi = motivo.grados.map(grado => midiPentatonico(registro + grado))
const ataques = motivo.tiempos
const duraciones = ataques.map((inicio, i) => Math.round(((ataques[i + 1] ?? INTERVALO_NODO) - inicio) / .125))
const destino = new URL('../docs/audio-propuestas/aventura-orbital/partituras/', import.meta.url)
await fs.mkdir(destino, { recursive: true })
const respuesta = await fetch('https://cdn.jsdelivr.net/npm/vexflow@4.2.5/build/cjs/vexflow.js')
if (!respuesta.ok) throw new Error('No se pudo obtener VexFlow.')
const motor = await respuesta.text()
const { chromium } = await import(pathToFileURL(modulo).href)
const browser = await chromium.launch({ executablePath, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 })
  await page.setContent(`<!doctype html><html lang="es"><meta charset="utf-8"><title>JOIN · Encuentro</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;color:#172538;font-family:'Segoe UI',Arial,sans-serif}
    article{width:1440px;height:860px;padding:55px 70px;background:linear-gradient(135deg,#fff 70%,#f4f7ff)}
    .eyebrow{color:#3667b6;font-size:16px;letter-spacing:3px;font-weight:700;margin:0 0 12px}
    h1{font-size:48px;letter-spacing:-1px;margin:0 0 10px;font-weight:650}h1 span{color:#3269bd}
    .sub{font-size:20px;color:#59697e;margin:0}.tags{display:flex;gap:14px;margin-top:24px}
    .tags span{background:#edf3fd;border:1px solid #d9e5f8;border-radius:22px;padding:9px 17px;color:#356092;font-size:16px}
    #score{margin-top:16px;height:410px}#score svg{overflow:visible}
    .footer{border-top:1px solid #dce4ef;padding-top:21px;font-size:18px;color:#53647a;line-height:1.6}
    .footer strong{color:#253d5b}.small{font-size:15px;color:#778497;margin-top:8px}
  </style><article><p class="eyebrow">ÁRBOLES Y SONIDO · AVENTURA ORBITAL</p><h1><span>JOIN</span> · Encuentro</h1>
    <p class="sub">Partitura del sample integrado en el ejemplo de biblioteca</p>
    <div class="tags"><span>6/8 · negra con puntillo = 80</span><span>Profundidad 2 · referencia D5</span><span>Altura real · sin transposición</span></div>
    <div id="score"></div><div class="footer"><strong>Trompa:</strong> Re5 · La5 · Sol5 · Si5 · La5 · Re6<br>
    <strong>Cuerdas:</strong> el mismo motivo una octava abajo.<div class="small">Se representa el ritmo de los ataques: un compás de 1.5 s. Las colas del audio se superponen y se extinguen a los 2 s.<br>Motivo original del prototipo. La base musical de acompañamiento no está incluida en esta partitura.</div></div>
  </article></html>`)
  await page.addScriptTag({ content: motor })
  const verificacion = await page.evaluate(({ midi, duraciones }) => {
    const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, Fraction, StaveConnector, Barline } = Vex.Flow
    const renderer = new Renderer(document.querySelector('#score'), Renderer.Backends.SVG)
    renderer.resize(1300, 410)
    const ctx = renderer.getContext()
    const superior = new Stave(170, 80, 1110).addClef('treble').addKeySignature('G').addTimeSignature('6/8')
    const inferior = new Stave(170, 265, 1110).addClef('treble').addKeySignature('G').addTimeSignature('6/8')
    superior.setEndBarType(Barline.type.END); inferior.setEndBarType(Barline.type.END)
    superior.setContext(ctx).draw(); inferior.setContext(ctx).draw()
    new StaveConnector(superior, inferior).setType(StaveConnector.type.BRACKET).setContext(ctx).draw()
    const nombres = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
    function linea(desplazamiento) {
      return midi.map((m, i) => {
        const nota = m + desplazamiento
        const duracion = ({ 1: '16', 2: '8', 3: '8d' })[duraciones[i]]
        if (!duracion) throw new Error('Ritmo fuera del exportador acotado.')
        const n = new StaveNote({ clef: 'treble', keys: [nombres[nota % 12] + '/' + (Math.floor(nota / 12) - 1)], duration: duracion, stem_direction: -1 })
        if (duracion === '8d') Dot.buildAndAttach([n], { all: true })
        return n
      })
    }
    const notas = [linea(0), linea(-12)]
    const haces = notas.map(ns => Beam.generateBeams(ns, { groups: [new Fraction(3, 8)], stem_direction: -1 }))
    const voces = notas.map(ns => new Voice({ num_beats: 6, beat_value: 8 }).addTickables(ns))
    new Formatter().joinVoices([voces[0]]).joinVoices([voces[1]]).format(voces, 900)
    voces[0].draw(ctx, superior); voces[1].draw(ctx, inferior)
    haces.flat().forEach(b => b.setContext(ctx).draw())
    ctx.setFont('Segoe UI', 18, '600').fillText('Trompa', 0, 143)
    ctx.setFont('Segoe UI', 18, '600').fillText('Cuerdas', 0, 328)
    ctx.setFont('Segoe UI', 14, 'normal').fillText('Línea principal', 0, 169)
    ctx.setFont('Segoe UI', 14, 'normal').fillText('Una octava abajo', 0, 354)
    return { midi, duracionesEnSemicorcheas: duraciones, totalSemicorcheas: duraciones.reduce((a,b)=>a+b,0), svg: document.querySelector('#score').innerHTML }
  }, { midi, duraciones })
  if (verificacion.totalSemicorcheas !== 12) throw new Error('El compás no suma 6/8.')
  await fs.writeFile(new URL('join-8.svg', destino), verificacion.svg)
  await page.screenshot({ path: fileURLToPath(new URL('join-8.png', destino)) })
  const { svg, ...datos } = verificacion
  await fs.writeFile(new URL('join-8.json', destino), JSON.stringify({ ...datos, fuente: 'src/modules/sonification/music.js', sample: 'join-8.wav', registro, ataquesSegundos: ataques }, null, 2) + '\n')
  console.log(JSON.stringify({ imagen: fileURLToPath(new URL('join-8.png', destino)), ...datos }, null, 2))
} finally { await browser.close() }
