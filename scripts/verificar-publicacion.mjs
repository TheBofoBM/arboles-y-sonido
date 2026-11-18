// Comprueba el sitio público sin reutilizar un servidor local.
// node scripts/verificar-publicacion.mjs <playwright/index.mjs> <chrome.exe> <url>
import { pathToFileURL, fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { comprobarInterfaz } from './comprobar-interfaz.mjs'

const [modulo, executablePath, url] = process.argv.slice(2)
if (!url?.startsWith('https://')) throw new Error('Indica la URL HTTPS publicada.')
const { chromium } = await import(pathToFileURL(modulo).href)
const browser = await chromium.launch({ executablePath, headless: true })
const errors = [], muestras = new Set(), output = new URL('../docs/evidencias/', import.meta.url)
await fs.mkdir(output, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`)
    if (response.ok() && new URL(response.url()).pathname.endsWith('.wav')) muestras.add(response.url())
  })
  const response = await page.goto(url)
  assert.equal(response.status(), 200)
  const resultado = await comprobarInterfaz(page, async (nombre, fullPage = false) => {
    await page.screenshot({ path: fileURLToPath(new URL(nombre + '-github-pages.png', output)), fullPage })
  })
  assert(muestras.size >= 4)
  assert.deepEqual(errors, [])
  const report = { fechaUTC: new Date().toISOString(), url, http: 200, ...resultado, sampleos: [...muestras], errors }
  await fs.writeFile(new URL('verificacion-github-pages.json', output), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
