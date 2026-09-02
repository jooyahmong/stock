/**
 * End-to-end smoke test for the Stock Planner (principle 31 scenarios).
 * Drives the real app in headless Chromium against `npm run dev`.
 *
 *   1. terminal A:  npm run dev
 *   2. terminal B:  node e2e/smoke.mjs
 */
import { chromium } from 'playwright'
import * as XLSX from 'xlsx'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const GPT_URL = 'https://chatgpt.com/g/g-smoke-test'
const results = []
let browser

/** Serve chatgpt.com from a local stub so My GPT tests stay offline & instant. */
async function stubChatgpt(context) {
  await context.route('**://chatgpt.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>ChatGPT stub</title><h1>stub</h1>',
    }),
  )
}

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

const PLAN_TYPE_LABEL = {
  Weekly: '주간',
  Monthly: '월간',
  '365': '365일 (날짜)',
  custom: '내 계획 (날짜)',
}

async function newPlan(page, name, type) {
  await page.getByRole('button', { name: '+ 새 계획' }).click()
  await page.locator('.modal .field-input').fill(name)
  if (type) {
    await page
      .locator('.type-option', { hasText: PLAN_TYPE_LABEL[type] ?? type })
      .locator('input')
      .check()
  }
  await page.locator('.modal').getByRole('button', { name: '만들기' }).click()
  await page.waitForTimeout(250)
}

/** Add one keyword on an exact date via the list view (+ 기간 추가 → + 키워드 추가). */
async function addKeywordOnDate(page, dateIso, keyword) {
  await page.getByRole('button', { name: '+ 기간 추가' }).click()
  await page.locator('.modal .field-input').fill(dateIso)
  await page.locator('.modal').getByRole('button', { name: '추가' }).click()
  const group = page
    .locator('.period-group')
    .filter({ has: page.locator('.pg-sub', { hasText: dateIso }) })
  await group.waitFor()
  const addBtn = group.getByRole('button', { name: '+ 키워드 추가' })
  if (await addBtn.count()) await addBtn.click() // add-row may already be open
  const input = group.locator('.pg-add input')
  await input.fill(keyword)
  await group.locator('.pg-add').getByRole('button', { name: '추가' }).click()
  await group.getByRole('button', { name: keyword, exact: true }).waitFor()
  await input.press('Escape').catch(() => {}) // close the add-row for the next call
}

const ok = (name) => results.push({ name, pass: true })
const fail = (name, err) => results.push({ name, pass: false, err: String(err && err.stack || err) })

async function test(name, fn) {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1200, height: 900 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  try {
    await fn(page, context)
    ok(name)
  } catch (err) {
    fail(name, err)
    try {
      await page.screenshot({ path: `e2e/fail-${name.replace(/\W+/g, '_')}.png` })
    } catch {}
  } finally {
    await context.close()
  }
}

// Captured from the seeded default plan so tests don't hard-code seed content.
let SEED_A = ''
let SEED_B = ''
let SEED_C = ''
let SEED_D = ''

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('.period-group .kw-text').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  const g0 = page.locator('.period-group').nth(0).locator('.kw-text')
  const g1 = page.locator('.period-group').nth(1).locator('.kw-text')
  const [a, b] = await g0.allInnerTexts()
  const [c, d] = await g1.allInnerTexts()
  SEED_A = a
  SEED_B = b
  SEED_C = c
  SEED_D = d
}

function xlsxFile(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'S1')
  return {
    name: 'test.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })),
  }
}

const run = async () => {
  browser = await chromium.launch()

  await test('seed = "365 스톡 키워드": 365 groups, 2 kw/day, no sample data', async (page) => {
    await boot(page)
    // The only plan is the rolling default pack (early sample plan is gone).
    const planLabel = await page.locator('.plan-current').innerText()
    if (!planLabel.includes('365 스톡 키워드') || !planLabel.includes('365일'))
      throw new Error('plan label: ' + JSON.stringify(planLabel))
    for (const bad of ['떡국', '일출', '복주머니', '겨울여행']) {
      if (await page.getByRole('button', { name: bad, exact: true }).count())
        throw new Error('old sample keyword still present: ' + bad)
    }
    for (const kw of [SEED_A, SEED_B, SEED_C, SEED_D]) {
      if (!kw) throw new Error('seed keyword not captured')
      await page.getByRole('button', { name: kw, exact: true }).first().waitFor()
    }
    // list is windowed by default (short); "전체 N일 보기" reveals all 365/730
    const windowedGroups = await page.locator('.period-group').count()
    if (windowedGroups > 40)
      throw new Error('default list should be windowed, got ' + windowedGroups)
    await page.getByRole('button', { name: /전체 \d+일 보기/ }).click()
    await page.waitForTimeout(400)
    const groupCount = await page.locator('.period-group').count()
    if (groupCount !== 365)
      throw new Error('expected 365 day-groups after 전체 보기, got ' + groupCount)
    const rowCount = await page.locator('.kw-row').count()
    if (rowCount !== 730) throw new Error('expected 730 keyword rows, got ' + rowCount)
    if (!/[가-힣]/.test(SEED_A)) throw new Error('seed keyword not Korean: ' + SEED_A)
  })

  await test('list window: 기본 슬라이스 + 이후 더 보기 ▼ + 전체 보기 토글 + 검색 우회', async (page) => {
    await boot(page)
    const n0 = await page.locator('.period-group').count()
    if (n0 < 8 || n0 > 30) throw new Error('unexpected default window size: ' + n0)

    await page.locator('.list-more-btn').click() // "이후 더 보기 ▼"
    await page.waitForTimeout(300)
    const n1 = await page.locator('.period-group').count()
    if (n1 <= n0) throw new Error('이후 더 보기 did not add groups')

    await page.getByRole('button', { name: /전체 \d+일 보기/ }).click()
    await page.waitForTimeout(500)
    if ((await page.locator('.period-group').count()) !== 365)
      throw new Error('전체 보기 should show all 365 groups')

    await page.getByRole('button', { name: '최근 날짜만 보기' }).click()
    await page.waitForTimeout(300)
    if ((await page.locator('.period-group').count()) > 40)
      throw new Error('접기 should return to the windowed slice')

    // search bypasses the window entirely
    await page.locator('.search').fill(SEED_A)
    await page.waitForTimeout(300)
    if (await page.locator('.list-more-btn').count())
      throw new Error('window controls should hide while searching')
  })

  await test('work-status check persists across reload (IndexedDB)', async (page) => {
    await boot(page)
    const row = page.locator('.kw-row', { hasText: SEED_A }).first()
    const genBox = row.locator('.status-check', { hasText: '생성' }).locator('input')
    await genBox.check()
    await page.waitForTimeout(200)
    await page.reload({ waitUntil: 'networkidle' })
    const row2 = page.locator('.kw-row', { hasText: SEED_A }).first()
    const genBox2 = row2.locator('.status-check', { hasText: '생성' }).locator('input')
    if (!(await genBox2.isChecked())) throw new Error('생성 check did not persist')
  })

  await test('selection checkbox is independent from work status', async (page) => {
    await boot(page)
    const row = page.locator('.kw-row', { hasText: SEED_B }).first()
    await row.locator('.select-box').check()
    if (!(await row.evaluate((el) => el.classList.contains('is-selected'))))
      throw new Error('row not marked selected')
    // status must be untouched
    const gen = row.locator('.status-check', { hasText: '생성' }).locator('input')
    if (await gen.isChecked()) throw new Error('selection wrongly toggled work status')
    await page.getByText('1개 선택됨').waitFor()
  })

  await test('날짜 그룹에는 선택 체크박스가 없다', async (page) => {
    await boot(page)
    if ((await page.locator('.pg-head input[type="checkbox"]').count()) !== 0)
      throw new Error('date group header still has a selection checkbox')
    // 키워드 행에는 여전히 있음
    if ((await page.locator('.kw-row .select-box').count()) < 1)
      throw new Error('keyword rows lost their selection checkbox')
  })

  await test('전체 선택: 현재 보이는 키워드만 선택 + SelectionBar', async (page) => {
    await boot(page)
    const visibleRows = await page.locator('.kw-row').count()
    await page.locator('.select-all input').check()
    await page.getByText(`${visibleRows}개 선택됨`).waitFor()
    if ((await page.locator('.kw-row.is-selected').count()) !== visibleRows)
      throw new Error('전체 선택이 보이는 행 전부를 선택하지 않음')
    // 일괄 삭제/체크 컨트롤 노출
    await page.locator('.selection-bar').getByRole('button', { name: '일괄 체크' }).waitFor()
    await page.locator('.select-all input').uncheck()
    if (await page.locator('.selection-bar').count())
      throw new Error('선택 해제 후에도 SelectionBar가 남아 있음')
  })

  await test('add keyword to a period group', async (page) => {
    await boot(page)
    const group = page.locator('.period-group').first()
    await group.getByRole('button', { name: '+ 키워드 추가' }).click()
    await group.locator('.pg-add input').fill('테스트 세배 키워드')
    await group.locator('.pg-add').getByRole('button', { name: '추가' }).click()
    await group.getByRole('button', { name: '테스트 세배 키워드', exact: true }).waitFor()
  })

  await test('add custom work stage -> new checkbox column appears', async (page) => {
    await boot(page)
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.getByRole('button', { name: '체크 항목' }).click()
    await page.getByRole('button', { name: '+ 체크 항목 추가' }).click()
    await page.locator('.field-input').fill('Adobe Stock')
    await page.getByRole('button', { name: '추가', exact: true }).click()
    await page.getByRole('button', { name: '닫기' }).first().click().catch(() => {})
    await page.keyboard.press('Escape')
    const row = page.locator('.kw-row', { hasText: SEED_A }).first()
    await row.locator('.status-check', { hasText: 'Adobe Stock' }).waitFor()
  })

  await test('Settings > 저장 · 백업: Local 안내 + Excel 백업 + 동기화 준비 중', async (page) => {
    await boot(page)
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.locator('.settings-tabs button', { hasText: '저장 · 백업' }).click()
    await page.getByText('이 기기에 저장').waitFor()
    const sync = page
      .locator('.gs-radio', { hasText: '계정으로 동기화' })
      .locator('input')
    if (!(await sync.isDisabled()))
      throw new Error('계정 동기화가 선택 가능 상태로 보임 (준비 중이어야 함)')
    await page.getByRole('button', { name: 'Excel 전체 백업' }).waitFor()
    await page.getByText(/API Key는 이 기기에만/).waitFor()
  })

  await test('search filters keywords', async (page) => {
    await boot(page)
    await page.locator('.search').fill(SEED_B)
    await page.waitForTimeout(150)
    if (await page.getByRole('button', { name: SEED_A, exact: true }).count())
      throw new Error('search did not filter out SEED_A')
    await page.getByRole('button', { name: SEED_B, exact: true }).waitFor()
  })

  await test('status filter (미완료 / 완료)', async (page) => {
    await boot(page)
    const row = page.locator('.kw-row', { hasText: SEED_A }).first()
    await row.locator('.status-check', { hasText: '생성' }).locator('input').check()
    await page.waitForTimeout(150)
    await page.locator('.filter-select').selectOption({ label: '생성 완료' })
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: SEED_A, exact: true }).waitFor()
    if (await page.getByRole('button', { name: SEED_B, exact: true }).count())
      throw new Error('완료 filter should hide unchecked SEED_B')
  })

  await test('Full Export = one row per keyword, TRUE/FALSE, dates repeated', async (page) => {
    await boot(page)
    const row = page.locator('.kw-row', { hasText: SEED_A }).first()
    await row.locator('.status-check', { hasText: '생성' }).locator('input').check()
    await page.waitForTimeout(150)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Full Export' }).click(),
    ])
    const stream = await download.createReadStream()
    const chunks = []
    for await (const c of stream) chunks.push(c)
    const wb = XLSX.read(Buffer.concat(chunks), { type: 'buffer' })
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
    if (aoa[0][0] !== 'Date' || aoa[0][1] !== 'Keyword')
      throw new Error('bad header: ' + JSON.stringify(aoa[0]))
    const jan01 = aoa.filter((r) => r[0] === '2027-01-01')
    if (jan01.length !== 2)
      throw new Error('expected 2 rows for 2027-01-01, got ' + jan01.length)
    if (jan01[0][0] !== jan01[1][0])
      throw new Error('date value not repeated on both rows')
    const ddk = aoa.find((r) => r[1] === SEED_A)
    if (ddk[2] !== 'TRUE') throw new Error('SEED_A 생성 should be TRUE, got ' + ddk[2])
    const ils = aoa.find((r) => r[1] === SEED_B)
    if (ils[2] !== 'FALSE') throw new Error('SEED_B 생성 should be FALSE')
  })

  await test('Download Template has Date | Keyword header', async (page) => {
    await boot(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Template', exact: true }).click(),
    ])
    const stream = await download.createReadStream()
    const chunks = []
    for await (const c of stream) chunks.push(c)
    const wb = XLSX.read(Buffer.concat(chunks), { type: 'buffer' })
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
    if (JSON.stringify(aoa[0]) !== JSON.stringify(['Date', 'Keyword']))
      throw new Error('bad template header ' + JSON.stringify(aoa[0]))
  })

  await test('Excel import: repeated dates, empty keyword, bad date -> preview + commit', async (page) => {
    await boot(page)
    // fresh plan
    await page.getByRole('button', { name: '+ 새 계획' }).click()
    await page.locator('.field-input').fill('Import Test')
    await page.getByRole('button', { name: '만들기' }).click()
    await page.waitForTimeout(200)

    await page.getByRole('button', { name: 'Import Excel' }).click()
    const file = xlsxFile([
      ['Date', 'Keyword'],
      ['2027-03-01', '봄나들이'],
      ['2027-03-01', '벚꽃'],
      ['2027-03-01', ''],
      ['2027-13-99', '잘못된날짜'],
      ['2027-03-02', '입학식'],
    ])
    await page.locator('input[type="file"]').setInputFiles(file)
    await page.getByText('새 항목').waitFor()
    const statsText = await page.locator('.import-stats').innerText()
    if (!statsText.includes('3')) throw new Error('expected 3 new items in preview: ' + statsText)
    if (!statsText.includes('오류')) throw new Error('expected error count shown')
    await page.getByRole('button', { name: '가져오기' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '봄나들이', exact: true }).waitFor()
    const march01 = page.locator('.period-group', { hasText: 'MAR 01' })
    if ((await march01.locator('.kw-row').count()) !== 2)
      throw new Error('MAR 01 should have 2 keywords (empty ignored)')
  })

  await test('keyword click copies text and opens the configured GPT URL', async (page, context) => {
    await stubChatgpt(context)
    await boot(page)
    // configure a My GPT generator
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.locator('.gen-add input.field-input').first().fill('Test GPT')
    await page.locator('.gen-add input.field-input').nth(1).fill(GPT_URL)
    await page.locator('.gen-add').getByRole('button', { name: '추가' }).click()
    await page.keyboard.press('Escape')

    const popupPromise = context.waitForEvent("page", { timeout: 12000 }).catch(() => null)
    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.getByText('프롬프트 복사됨').waitFor()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    if (clip !== SEED_A) throw new Error('clipboard = ' + JSON.stringify(clip))
    const popup = await popupPromise
    if (!popup) throw new Error('no new tab opened')
    if (!popup.url().startsWith('https://chatgpt.com/'))
      throw new Error('opened wrong url: ' + popup.url())
  })

  await test('My GPT: 키워드 클릭마다 GPT URL 새 탭 + 프롬프트 복사', async (page, context) => {
    await stubChatgpt(context)
    await boot(page)
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.locator('.gen-add input.field-input').first().fill('T GPT')
    await page.locator('.gen-add input.field-input').nth(1).fill(GPT_URL)
    await page.locator('.gen-add').getByRole('button', { name: '추가' }).click()
    await page.keyboard.press('Escape')

    let opened = 0
    context.on('page', () => {
      opened++
    })

    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.waitForTimeout(700)
    if (opened !== 1) throw new Error(`1st click should open a tab, opened=${opened}`)

    await page.getByRole('button', { name: SEED_B, exact: true }).click()
    await page.waitForTimeout(700)
    if (opened !== 2) throw new Error(`2nd click should open another tab, opened=${opened}`)

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    if (clip !== SEED_B) throw new Error('clipboard = ' + JSON.stringify(clip))
    await page.getByText('프롬프트 복사됨').waitFor()

    // every opened tab is the configured chatgpt.com URL
    const gptTabs = context.pages().filter((p) => p.url().startsWith('https://chatgpt.com/'))
    if (gptTabs.length !== 2)
      throw new Error(`expected 2 chatgpt.com tabs, got ${gptTabs.length}`)

    // "GPT 열기" also opens the URL
    await page.getByRole('button', { name: 'GPT 열기' }).click()
    await page.waitForTimeout(500)
    if (opened !== 3) throw new Error('"GPT 열기" should open a tab')
  })

  await test('My GPT URL 검증: chatgpt.com https 링크만 저장 허용', async (page) => {
    await boot(page)
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    const nameInput = page.locator('.gen-add input.field-input').first()
    const urlInput = page.locator('.gen-add input.field-input').nth(1)
    const addBtn = page.locator('.gen-add').getByRole('button', { name: '추가' })

    await nameInput.fill('Bad')
    await urlInput.fill('https://evil.example.com/g/x')
    await page.locator('.gen-add .hint-error').waitFor()
    if (!(await addBtn.isDisabled())) throw new Error('non-chatgpt URL must not be saveable')

    await urlInput.fill('javascript:alert(1)')
    if (!(await addBtn.isDisabled())) throw new Error('javascript: URL must not be saveable')

    await urlInput.fill('http://chatgpt.com/g/g-x')
    if (!(await addBtn.isDisabled())) throw new Error('http (non-https) must not be saveable')

    await urlInput.fill('https://chatgpt.com/g/g-ok')
    await addBtn.click()
    await page.locator('.gen-row').waitFor()
  })

  await test('keyword click with no generator warns instead of opening', async (page) => {
    await boot(page)
    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.getByText('GPT URL을 먼저 저장').waitFor()
  })

  // ---- Generation: Direct Generate + My GPT --------------------------------

  const TINY_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  async function openGenerationTab(page, mode) {
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.locator('.settings-tabs button', { hasText: '생성' }).click()
    if (mode === 'direct') {
      await page
        .locator('.gs-radio', { hasText: 'Direct Generate' })
        .locator('input')
        .check()
    } else if (mode === 'my-gpt') {
      await page
        .locator('.gs-radio', { hasText: 'My GPT' })
        .first()
        .locator('input')
        .check()
    }
  }

  await test('Settings > 생성: 선택한 방식의 설정만 표시', async (page) => {
    await boot(page)
    await openGenerationTab(page)
    await page.getByText('기본 생성 방식').waitFor()
    await page.locator('.gs-radio', { hasText: 'Direct Generate' }).waitFor()
    await page.locator('.gs-radio', { hasText: 'My GPT' }).first().waitFor()
    // default = my-gpt → My GPT 설정만, Direct 상세는 숨김
    await page.getByRole('heading', { name: 'My GPT' }).waitFor()
    if (await page.getByRole('button', { name: 'Test Connection' }).count())
      throw new Error('Direct 상세가 my-gpt 모드에서 보임')
    // Direct 선택 → Direct 상세만, My GPT 숨김
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.getByText('API Key', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Test Connection' }).waitFor()
    if (await page.getByRole('heading', { name: 'My GPT' }).count())
      throw new Error('My GPT 설정이 direct 모드에서 보임')
  })

  await test('기본=Direct + provider 없음 -> fallback 모달 (API 설정 / My GPT)', async (page) => {
    await boot(page)
    await openGenerationTab(page)
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.getByText('API를 먼저 연결하세요').waitFor()
    await page.getByRole('button', { name: 'API 설정' }).waitFor()
    // My GPT 미등록 -> "My GPT 설정" 안내 버튼
    await page.getByRole('button', { name: 'My GPT 설정' }).waitFor()
  })

  await test('기본=Direct + provider 없음 + My GPT 등록됨 -> My GPT로 열기 동작', async (page, context) => {
    await stubChatgpt(context)
    await boot(page)
    await openGenerationTab(page)
    // register My GPT
    await page.locator('.gen-add input.field-input').first().fill('T GPT')
    await page.locator('.gen-add input.field-input').nth(1).fill(GPT_URL)
    await page.locator('.gen-add').getByRole('button', { name: '추가' }).click()
    // switch default mode to Direct
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.keyboard.press('Escape')

    const popupPromise = context.waitForEvent("page", { timeout: 12000 }).catch(() => null)
    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.getByRole('button', { name: 'My GPT로 열기' }).click()
    const popup = await popupPromise
    if (!popup || !popup.url().startsWith('https://chatgpt.com/'))
      throw new Error('My GPT fallback did not open the tab: ' + (popup && popup.url()))
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    if (clip !== SEED_A) throw new Error('clipboard = ' + JSON.stringify(clip))
  })

  await test('Direct Generate 성공 -> 이미지 표시 + "생성" 자동 체크', async (page) => {
    await page.route('**://api.openai.com/v1/images/generations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ b64_json: TINY_PNG }] }),
      }),
    )
    await boot(page)
    await openGenerationTab(page, 'direct')
    await page.locator('input[type="password"]').fill('sk-test-key')
    await page.locator('select.field-input').nth(1).selectOption('gpt-image-1').catch(() => {})
    await page.getByRole('button', { name: 'Save' }).click()
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: SEED_A, exact: true }).click()
    await page.locator('.gen-result img').waitFor({ timeout: 15000 })
    await page.getByText('"생성" 체크됨').waitFor()
    await page.locator('.modal-head .icon-btn').click() // close modal
    const row = page.locator('.kw-row', { hasText: SEED_A }).first()
    const gen = row.locator('.status-check', { hasText: '생성' }).locator('input')
    if (!(await gen.isChecked())) throw new Error('생성 was not auto-checked after success')
    // persists
    await page.reload({ waitUntil: 'networkidle' })
    const gen2 = page
      .locator('.kw-row', { hasText: SEED_A }).first()
      .locator('.status-check', { hasText: '생성' })
      .locator('input')
    if (!(await gen2.isChecked())) throw new Error('auto-check did not persist')
  })

  await test('Direct Generate 실패 -> "생성" 체크 안 함 + 재시도 노출', async (page) => {
    await page.route('**://api.openai.com/v1/images/generations', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'content policy violation' } }),
      }),
    )
    await boot(page)
    await openGenerationTab(page, 'direct')
    await page.locator('input[type="password"]').fill('sk-test-key')
    await page.getByRole('button', { name: 'Save' }).click()
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: SEED_B, exact: true }).click()
    await page.locator('.gen-error-box').waitFor()
    await page.getByText('체크되지 않았습니다').waitFor()
    await page.getByRole('button', { name: '다시 시도' }).waitFor()
    await page.locator('.modal-head .icon-btn').click()
    const gen = page
      .locator('.kw-row', { hasText: SEED_B }).first()
      .locator('.status-check', { hasText: '생성' })
      .locator('input')
    if (await gen.isChecked()) throw new Error('생성 must NOT be checked on failure')
  })

  await test('mobile viewport: no horizontal page overflow', async (page) => {
    await page.setViewportSize({ width: 375, height: 780 })
    await boot(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 2) throw new Error('horizontal overflow of ' + overflow + 'px')
  })

  // ---- Calendar View ------------------------------------------------------

  await test('Calendar: 토글 → 7열 grid, 과거 생성완료 ○ / 미완료 ×', async (page) => {
    await boot(page)
    await newPlan(page, 'Cal Test 1')
    const now = new Date()
    const pastIso = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 15))
    await addKeywordOnDate(page, pastIso, 'past done')
    await addKeywordOnDate(page, pastIso, 'past miss')
    await page
      .locator('.kw-row', { hasText: 'past done' })
      .locator('.status-check', { hasText: '생성' })
      .locator('input')
      .check()
    await page.waitForTimeout(150)

    await page.getByRole('tab', { name: '달력 보기' }).click()
    await page.locator('.cal-grid').waitFor()
    const wd = (await page.locator('.cal-wd').allInnerTexts()).join(',')
    if (wd !== 'SUN,MON,TUE,WED,THU,FRI,SAT') throw new Error('weekday header: ' + wd)

    const doneLine = page.locator('.cal-kw', { hasText: 'past done' })
    const missLine = page.locator('.cal-kw', { hasText: 'past miss' })
    await doneLine.waitFor()
    if ((await doneLine.locator('.cal-mark-done').count()) !== 1)
      throw new Error('past + generated should show ○')
    if ((await missLine.locator('.cal-mark-missing').count()) !== 1)
      throw new Error('past + not generated should show ×')
    // same-day keywords carry independent marks
    if ((await doneLine.locator('.cal-mark-missing').count()) !== 0)
      throw new Error('done line must not also show ×')
  })

  await test('Calendar: 오늘·미래 키워드는 O/X 표시 안 함', async (page) => {
    await boot(page)
    await newPlan(page, 'Cal Test 2')
    const now = new Date()
    const todayIso = ymd(now)
    const nextMonthIso = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 10))
    await addKeywordOnDate(page, todayIso, 'today kw')
    await addKeywordOnDate(page, nextMonthIso, 'future kw')

    await page.getByRole('tab', { name: '달력 보기' }).click()
    const todayLine = page.locator('.cal-kw', { hasText: 'today kw' })
    await todayLine.waitFor()
    if ((await todayLine.locator('.cal-mark').count()) !== 0)
      throw new Error('today keyword must have no O/X')
    await page.locator('.cal-cell-today').waitFor() // today is highlighted

    await page.getByRole('button', { name: '다음 달' }).click()
    const futureLine = page.locator('.cal-kw', { hasText: 'future kw' })
    await futureLine.waitFor()
    if ((await futureLine.locator('.cal-mark').count()) !== 0)
      throw new Error('future keyword must have no O/X')
  })

  await test('Calendar: 긴 키워드는 한 줄 ellipsis, 전체는 title', async (page) => {
    await boot(page)
    await newPlan(page, 'Cal Test 3')
    const now = new Date()
    const pastIso = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 12))
    const longKw = '어린이집에서 즐기는 가을 가족 나들이 아주 아주 긴 키워드 문자열'
    await addKeywordOnDate(page, pastIso, longKw)

    await page.getByRole('tab', { name: '달력 보기' }).click()
    const line = page.locator('.cal-kw', { hasText: '어린이집에서' })
    await line.waitFor()
    if ((await line.getAttribute('title')) !== longKw)
      throw new Error('title must hold the full keyword text')
    const css = await line.locator('.cal-kw-text').evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        over: `${s.textOverflow}/${s.whiteSpace}/${s.overflow}`,
        clipped: el.scrollWidth > el.clientWidth,
      }
    })
    if (css.over !== 'ellipsis/nowrap/hidden') throw new Error('css: ' + css.over)
    if (!css.clipped) throw new Error('long keyword should overflow its cell box')
  })

  await test('Calendar: 하루 4개 이상 → +N개, 클릭 시 전체 목록', async (page, context) => {
    await stubChatgpt(context)
    await boot(page)
    await newPlan(page, 'Cal Test 4')
    // My GPT so keyword click has a handler
    await page.getByRole('button', { name: '⚙ 설정' }).click()
    await page.locator('.gen-add input.field-input').first().fill('T GPT')
    await page.locator('.gen-add input.field-input').nth(1).fill(GPT_URL)
    await page.locator('.gen-add').getByRole('button', { name: '추가' }).click()
    await page.keyboard.press('Escape')

    const now = new Date()
    const pastIso = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 20))
    for (const k of ['추석 송편', '한복 가족', '보름달 배경', '성묘 준비', '차례상']) {
      await addKeywordOnDate(page, pastIso, k)
    }

    await page.getByRole('tab', { name: '달력 보기' }).click()
    const body = page.locator('.cal-cell-body', { hasText: '+2개' })
    await body.waitFor()
    if ((await body.locator('.cal-kw').count()) !== 3)
      throw new Error('cell should show exactly 3 keyword lines + "+N개"')

    await page.getByRole('button', { name: '+2개' }).click()
    const modal = page.locator('.modal', { hasText: '차례상' })
    await modal.waitFor()
    if ((await modal.locator('.cal-kw').count()) !== 5)
      throw new Error('day modal should list all 5 keywords')

    await modal.locator('.cal-kw', { hasText: '차례상' }).click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    if (clip !== '차례상') throw new Error('clipboard = ' + JSON.stringify(clip))
    await page.getByText('프롬프트 복사됨').waitFor()
  })

  await test('Calendar: 키워드 클릭 → 기존 generation handler 재사용 (Direct → GenerateModal)', async (page) => {
    await page.route('**://api.openai.com/v1/images/generations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ b64_json: TINY_PNG }] }),
      }),
    )
    await boot(page)
    await newPlan(page, 'Cal Test 5')
    await openGenerationTab(page, 'direct')
    await page.locator('input[type="password"]').fill('sk-test-key')
    await page.getByRole('button', { name: 'Save' }).click()
    await page
      .locator('.gs-radio', { hasText: 'Direct Generate' })
      .locator('input')
      .check()
    await page.keyboard.press('Escape')

    const now = new Date()
    const pastIso = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 8))
    await addKeywordOnDate(page, pastIso, 'red apple')

    await page.getByRole('tab', { name: '달력 보기' }).click()
    await page.locator('.cal-kw', { hasText: 'red apple' }).click()
    // exactly the list view's GenerateModal — proves the handler is reused
    await page.locator('.gen-result img').waitFor({ timeout: 15000 })
  })

  await test('Calendar: 이전/다음 달 이동 + [오늘]', async (page) => {
    await boot(page)
    await newPlan(page, 'Cal Test 6')
    await page.getByRole('tab', { name: '달력 보기' }).click()
    const title = () => page.locator('.cal-title').innerText()
    const t0 = await title()
    await page.getByRole('button', { name: '다음 달' }).click()
    if ((await title()) === t0) throw new Error('다음 달 did not change the month')
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.getByRole('button', { name: '이전 달' }).click()
    if ((await title()) === t0) throw new Error('이전 달 did not change the month')
    await page.getByRole('button', { name: '오늘' }).click()
    if ((await title()) !== t0) throw new Error('[오늘] should return to the starting month')
  })

  await test('Calendar: 기본 팩의 12개월 연속 표시 (롤링 윈도우)', async (page) => {
    await boot(page)
    await page.getByRole('tab', { name: '달력 보기' }).click()
    await page.locator('.cal-grid').waitFor()
    const seen = []
    for (let i = 0; i < 12; i++) {
      const title = (await page.locator('.cal-title').innerText()).trim()
      if (!/^[A-Z][a-z]+ \d{4}$/.test(title))
        throw new Error(`month ${i + 1}: bad title "${title}"`)
      if (seen.includes(title)) throw new Error('month repeated: ' + title)
      seen.push(title)
      const kwCount = await page.locator('.cal-grid .cal-kw').count()
      if (kwCount < 1) throw new Error(`${title} shows no keywords`)
      if (i < 11) await page.getByRole('button', { name: '다음 달' }).click()
    }
    if (seen.length !== 12) throw new Error('expected 12 distinct months')
  })

  await test('Calendar: Weekly 계획에서는 달력 보기 비활성', async (page) => {
    await boot(page)
    await newPlan(page, 'Wk Plan', 'Weekly')
    const calBtn = page.getByRole('tab', { name: '달력 보기' })
    if (!(await calBtn.isDisabled()))
      throw new Error('달력 보기 must be disabled for non-date plans')
  })

  await test('Calendar mobile: agenda 표시, page 가로 스크롤 없음', async (page) => {
    await page.setViewportSize({ width: 375, height: 780 })
    await boot(page)
    await newPlan(page, 'Cal Mobile')
    const now = new Date()
    const pastIso = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 5))
    await addKeywordOnDate(page, pastIso, 'mobile kw')

    await page.getByRole('tab', { name: '달력 보기' }).click()
    await page.locator('.cal-agenda').waitFor()
    if ((await page.locator('.cal-grid').count()) !== 0)
      throw new Error('narrow view must not render the 7-col grid')
    await page.locator('.cal-kw', { hasText: 'mobile kw' }).waitFor()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 2) throw new Error('horizontal overflow of ' + overflow + 'px')
  })

  await browser.close()

  // report
  const passed = results.filter((r) => r.pass).length
  console.log('\n──────── E2E smoke results ────────')
  for (const r of results) {
    console.log(`${r.pass ? '✓' : '✗'} ${r.name}`)
    if (!r.pass) console.log('   ' + r.err.split('\n').slice(0, 3).join('\n   '))
  }
  console.log(`\n${passed}/${results.length} passed`)
  process.exit(passed === results.length ? 0 : 1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
