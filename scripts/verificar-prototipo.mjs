// Verificación de navegador aislado. No añade dependencias al proyecto.
// node scripts/verificar-prototipo.mjs <playwright/index.mjs> <chrome.exe>
import fs from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const [modulo, executablePath, modo = 'dev', subruta = '/'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(modulo).href)
const port = modo === 'preview' ? 4183 : 5183
const origin = `http://127.0.0.1:${port}`
const base = origin + subruta
const output = new URL('../docs/evidencias/', import.meta.url)
const sufijo = subruta === '/' ? modo : `${modo}-subruta`
await fs.mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(modo === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = '', browser
server.stdout.on('data', d => { logs += d }); server.stderr.on('data', d => { logs += d })
const errors = [], checks = []
try {
  let listo = false
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(logs)
    try { if ((await fetch(base)).ok) { listo = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(listo, 'Vite no inició')
  browser = await chromium.launch({ executablePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text() + ' ' + message.location().url) })
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`) })
  await page.goto(base)
  await page.getByRole('button', { name: 'Procesar JSON', exact: true }).click()
  await page.getByRole('heading', { name: 'Resultado estructurado', exact: true }).waitFor()
  assert.match(await page.locator('.tree-stats').innerText(), /3/)
  checks.push('JSON existente: generación y resultado de 3 nodos')
  await page.getByRole('button', { name: 'SQL', exact: true }).click()
  await page.getByRole('button', { name: 'Generar árbol desde SQL', exact: true }).click()
  await page.getByRole('button', { name: 'Aplicar reglas disponibles' }).click()
  await page.getByText('Historial: 3 transformaciones', { exact: true }).waitFor()
  assert.equal(await page.locator('.node-card').count(), 6)
  checks.push('SQL de biblioteca: 3 pasos, 6 nodos y recuperación con deshacer')
  await page.getByRole('button', { name: 'Deshacer paso', exact: true }).click()
  await page.getByText('Historial: 2 transformaciones', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Aplicar siguiente regla' }).click()
  await page.getByRole('button', { name: 'Comparar original y actual' }).click()
  await page.getByRole('heading', { name: /Equivalencia reconocida/ }).waitFor()
  assert.equal(await page.locator('#tipo-a').inputValue(), 'json')
  assert.equal(await page.locator('#tipo-b').inputValue(), 'json')
  checks.push('Transferencia de original/transformado a comparación A/B')
  await page.getByRole('button', { name: 'Cargar par equivalente de biblioteca' }).click()
  await page.getByRole('button', { name: 'Generar y comparar árboles' }).click()
  await page.getByRole('heading', { name: /Equivalencia reconocida/ }).waitFor()
  assert.equal(await page.locator('[aria-label="Resultado A"] .node-card').count(), 5)
  assert.equal(await page.locator('[aria-label="Resultado B"] .node-card').count(), 6)
  await page.getByRole('checkbox', { name: /Comparar las referencias heurísticas/ }).check()
  assert.equal(await page.locator('[aria-label="Resultado A"] .node-card').count(), 6)
  const a = page.getByRole('region', { name: 'Sampleos de A', exact: true })
  const b = page.getByRole('region', { name: 'Sampleos de B', exact: true })
  await a.getByRole('button', { name: 'Escuchar A', exact: true }).click()
  await page.locator('[aria-label="Resultado A"] [aria-current="step"]').waitFor()
  await b.getByRole('button', { name: 'Escuchar B', exact: true }).click()
  await page.locator('[aria-label="Resultado B"] [aria-current="step"]').waitFor()
  assert.equal(await a.getByRole('button', { name: 'Escuchar A', exact: true }).isEnabled(), true)
  // Espera por el fin real de la última fuente: seis inicios + cola, no recorta.
  await b.getByRole('button', { name: 'Escuchar B', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Sampleos de B"] button').disabled, null, { timeout: 12000 })
  assert.equal(await page.locator('[aria-current="step"]').count(), 0)
  checks.push('WAV decodificados en Chrome; A se detiene al iniciar B; B termina el recorrido de 6 nodos')
  await page.screenshot({ path: fileURLToPath(new URL(`comparacion-sampleos-${sufijo}.png`, output)), fullPage: true })
  await page.locator('.comparison-summary').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 24))
  await page.screenshot({ path: fileURLToPath(new URL(`comparacion-vista-${sufijo}.png`, output)) })
  await page.getByRole('button', { name: 'Álgebra relacional', exact: true }).click()
  await page.getByRole('button', { name: 'Generar árbol', exact: true }).click()
  assert.equal(await page.locator('.node-card').count(), 5)
  await page.locator('#algebra-input').fill('PI[*](Libro)')
  await page.getByRole('button', { name: 'Generar árbol', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.locator('.node-card').count(), 0)
  checks.push('Álgebra: generar árbol, error legible y retirada del resultado obsoleto')
  await page.getByRole('button', { name: 'Comparar A / B', exact: true }).click()
  const beforeB = await page.locator('#texto-b').inputValue()
  await page.locator('#texto-a').fill('SELECT * FROM Libro')
  assert.equal(await page.locator('.results-columns').count(), 0)
  await page.getByRole('button', { name: 'Generar y comparar árboles' }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.locator('#texto-b').inputValue(), beforeB)
  checks.push('Comparación: edición invalida resultados y A no modifica B')
  await page.getByRole('button', { name: 'Cargar par equivalente de biblioteca' }).click()
  await page.getByRole('button', { name: 'Generar y comparar árboles' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: fileURLToPath(new URL(`comparacion-movil-${sufijo}.png`, output)), fullPage: true })
  checks.push('Móvil 390px: sin desbordamiento horizontal')
  assert.deepEqual(errors, [])
} finally {
  if (browser) await browser.close()
  if (server.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else server.kill()
  }
}
let puertoCerrado = false
try { await fetch(base) } catch { puertoCerrado = true }
assert(puertoCerrado, 'El servidor no terminó')
const report = { fechaUTC: new Date().toISOString(), modo, subruta, checks, errors, puertoCerrado }
await fs.writeFile(new URL(`verificacion-navegador-${sufijo}.json`, output), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
