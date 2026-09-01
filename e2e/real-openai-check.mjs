/**
 * ONE-OFF real-API verification for Direct Generate. Not part of the app.
 * Does NOT modify any src/ code. Performs exactly ONE real image generation.
 *
 * Key source (never printed, never committed):
 *   - env  OPENAI_API_KEY=...            (preferred)
 *   - or   e2e/.openai-key.local  file   (gitignored via *.local)
 * Optional: OPENAI_IMAGE_MODEL (default gpt-image-1; try dall-e-3 if 403).
 *
 * Run (dev server must be up):  node e2e/real-openai-check.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
const KEYWORD = 'simple red apple on white background'

let KEY = process.env.OPENAI_API_KEY || ''
if (!KEY) {
  try {
    KEY = readFileSync(new URL('./.openai-key.local', import.meta.url), 'utf8').trim()
  } catch {}
}
if (!KEY) {
  console.error(
    'No API key. Set OPENAI_API_KEY env var, or put the key in e2e/.openai-key.local',
  )
  process.exit(2)
}

const sanitize = (s) =>
  String(s || '').replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***').slice(0, 400)

const report = {
  realApiCall: 'unknown',
  httpStatus: 'unknown',
  corsBlocked: 'unknown',
  imageShownInModal: 'unknown',
  autoCheckedGenerated: 'unknown',
  persistedAfterReload: 'unknown',
  diagnosis: [],
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

let apiStatus = null
let apiFailureText = null
let corsConsole = false

page.on('response', (res) => {
  if (res.url().includes('api.openai.com/v1/images/generations')) {
    apiStatus = res.status()
  }
})
page.on('requestfailed', (req) => {
  if (req.url().includes('api.openai.com/v1/images/generations')) {
    apiFailureText = req.failure()?.errorText || 'requestfailed'
  }
})
page.on('console', (msg) => {
  if (/CORS|Access-Control-Allow-Origin|Cross-Origin Request Blocked/i.test(msg.text())) {
    corsConsole = true
  }
})

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('JAN 01').first().waitFor({ timeout: 10000 })

  // Settings > 생성 > Direct Generate
  await page.getByRole('button', { name: '⚙ 설정' }).click()
  await page.locator('.settings-tabs button', { hasText: '생성' }).click()
  await page.locator('input[type="password"]').fill(KEY) // fill() does not echo
  await page.locator('select.field-input').nth(1).selectOption(MODEL).catch(() => {})
  await page.getByRole('button', { name: 'Save' }).click()
  await page
    .locator('.gs-radio', { hasText: 'Direct Generate' })
    .locator('input')
    .check()
  await page.keyboard.press('Escape')

  // Add the test keyword and click it (Direct mode -> internal Generator modal)
  const group = page.locator('.period-group', { hasText: 'JAN 01' })
  await group.getByRole('button', { name: '+ 키워드 추가' }).click()
  await group.locator('.pg-add input').fill(KEYWORD)
  await group.getByRole('button', { name: '추가' }).click()
  const kwBtn = page.getByRole('button', { name: KEYWORD, exact: true })
  await kwBtn.waitFor({ timeout: 8000 })
  await kwBtn.click()

  const outcome = await Promise.race([
    page.locator('.gen-result img').waitFor({ timeout: 120000 }).then(() => 'image'),
    page.locator('.gen-error-box').waitFor({ timeout: 120000 }).then(() => 'error'),
  ]).catch(() => 'timeout')

  report.httpStatus =
    apiStatus != null
      ? String(apiStatus)
      : apiFailureText
        ? 'no HTTP response (request failed at network layer)'
        : 'not observed'
  const corsFromFailure = !!apiFailureText && /cors|blocked|access control/i.test(apiFailureText)
  report.corsBlocked = corsFromFailure || corsConsole ? 'YES' : 'no'
  if (apiFailureText) report.diagnosis.push('network failure: ' + sanitize(apiFailureText))

  if (outcome === 'image') {
    report.realApiCall = 'SUCCESS'
    report.imageShownInModal = 'YES'
    const src = await page.locator('.gen-result img').getAttribute('src')
    report.diagnosis.push(
      'image src: ' + (src ? src.slice(0, 24) + `… (${src.length} chars)` : 'missing'),
    )
    await page.locator('.modal-head .icon-btn').click() // close modal

    const genInput = page
      .locator('.kw-row', { hasText: KEYWORD })
      .locator('.status-check', { hasText: '생성' })
      .locator('input')
    report.autoCheckedGenerated = (await genInput.isChecked()) ? 'YES' : 'NO'

    await page.reload({ waitUntil: 'networkidle' })
    const genInput2 = page
      .locator('.kw-row', { hasText: KEYWORD })
      .locator('.status-check', { hasText: '생성' })
      .locator('input')
    report.persistedAfterReload = (await genInput2.isChecked()) ? 'YES' : 'NO'
  } else if (outcome === 'error') {
    report.realApiCall = 'FAIL'
    report.imageShownInModal = 'NO'
    report.autoCheckedGenerated = 'NO (correct — no auto-check on failure)'
    report.persistedAfterReload = 'n/a'
    const msg = await page
      .locator('.gen-error-box .error-text')
      .innerText()
      .catch(() => '')
    report.diagnosis.push('modal error: ' + sanitize(msg))
  } else {
    report.realApiCall = 'TIMEOUT (no image, no error within 120s)'
  }
} catch (err) {
  report.realApiCall = 'HARNESS ERROR'
  report.diagnosis.push(sanitize(err && err.message))
} finally {
  await browser.close()
}

console.log('\n===== Direct Generate — real OpenAI check =====')
console.log(JSON.stringify(report, null, 2))
process.exit(report.realApiCall === 'SUCCESS' ? 0 : 1)
