// Verificación de navegador aislado. No añade dependencias al proyecto.
// node scripts/verificar-prototipo.mjs <playwright/index.mjs> <chrome.exe>
import fs from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { comprobarInterfaz } from './comprobar-interfaz.mjs'

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
  const resultado = await comprobarInterfaz(page, async (nombre, fullPage = false) => {
    await page.screenshot({ path: fileURLToPath(new URL(nombre + '-' + sufijo + '.png', output)), fullPage })
  })
  checks.push(...resultado.checks)
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
