// Comprueba el sitio público sin reutilizar un servidor local.
// node scripts/verificar-publicacion.mjs <playwright/index.mjs> <chrome.exe> <url>
import { pathToFileURL, fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

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
  await page.getByRole('button', { name: 'Procesar JSON', exact: true }).click()
  assert.equal(await page.locator('.node-card').count(), 3)
  await page.getByRole('button', { name: 'Comparar A / B', exact: true }).click()
  await page.getByRole('button', { name: 'Generar y comparar árboles' }).click()
  await page.getByRole('heading', { name: /Equivalencia reconocida/ }).waitFor()
  assert.equal(await page.locator('[aria-label="Resultado A"] .node-card').count(), 5)
  assert.equal(await page.locator('[aria-label="Resultado B"] .node-card').count(), 6)
  await page.getByRole('checkbox', { name: /Comparar las referencias heurísticas/ }).check()
  const player = page.getByRole('region', { name: 'Sampleos de B', exact: true })
  await player.getByRole('button', { name: 'Escuchar B', exact: true }).click()
  await page.locator('[aria-label="Resultado B"] [aria-current="step"]').waitFor()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Sampleos de B"] button').disabled, null, { timeout: 15000 })
  assert(muestras.size >= 4)
  await page.locator('.comparison-summary').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24))
  await page.screenshot({ path: fileURLToPath(new URL('github-pages-comparacion.png', output)) })
  await page.getByRole('button', { name: 'Álgebra relacional', exact: true }).click()
  await page.getByRole('button', { name: 'Generar árbol', exact: true }).click()
  assert.equal(await page.locator('.node-card').count(), 5)
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(errors, [])
  const report = { fechaUTC: new Date().toISOString(), url, http: 200, json: '3 nodos', algebra: '5 nodos', comparacion: 'A: 5 nodos; B: 6 nodos; equivalencia por reglas', sampleos: [...muestras], reproduccionCompleta: true, movilSinDesbordamiento: true, errors }
  await fs.writeFile(new URL('verificacion-github-pages.json', output), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
