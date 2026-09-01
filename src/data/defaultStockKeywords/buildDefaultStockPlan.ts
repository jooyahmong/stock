import type { Category, SeedKeyword, SeedRow } from './types'
import { ordinalOfDate, todayLocalIso, windowDates } from './dateUtils'
import { eventSeeds } from './events'
import {
  CATEGORY_POOLS,
  PASS_QUALIFIERS,
  SEASONAL_BY_MONTH,
  SOUTHERN_COUNTER_SEASON,
} from './pools'

type FillCategory = 'seasonal' | keyof typeof CATEGORY_POOLS

/** 슬롯0(주제) 카테고리 스케줄 — 연간 균형을 위해 조정. */
const FILL_ROTATION: FillCategory[] = [
  'seasonal',
  'lifestyle',
  'food',
  'business',
  'seasonal',
  'health',
  'travel',
  'education',
  'seasonal',
  'lifestyle',
  'technology',
  'food',
]

const DEFAULT_DAYS = 365

/** Final safety net for cross-pool collisions (rare — pass-qualifiers do the work). */
function makeUnique(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) candidate = `${base} ${n++}`
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * 오늘부터(기본) 365일 스톡 키워드 팩.
 *
 * - `startIso`(기본: 로컬 오늘)부터 `days`일 연속. 총 730개 키워드.
 * - **채우기(fill)** 콘텐츠는 각 날짜의 (월, 일) 서수로만 결정된다 → 어느 해든
 *   같은 (월, 일)은 같은 채우기 키워드. 매년 동일 사이클로 루프.
 * - **이벤트**는 실제 날짜 기준 ~61일(≈2개월) 전 제작일에 그날의 두 슬롯을
 *   덮어쓴다(이벤트 우선). 창이 두 해를 걸치므로 12월 제작분이 다음 해 2월을
 *   준비하는 식으로 이어진다.
 * - 하루 정확히 2개: 슬롯0 = 인물/라이프스타일 주제, 슬롯1 = 디자인 배경/보조 주제.
 * - 팩 전체에서 완전히 동일한 키워드 없음.
 * - keywordStatus 행을 만들지 않음 → 생성/미캔/사용자 상태 모두 FALSE.
 */
export function buildDefaultStockPlanDetailed(
  startIso: string = todayLocalIso(),
  days: number = DEFAULT_DAYS,
): SeedKeyword[] {
  const dates = windowDates(startIso, days)
  const windowSet = new Set(dates)
  const used = new Set<string>()
  const bySlot = new Map<string, SeedKeyword[]>()

  // ---- Phase 1: (월, 일) 서수 기반 결정론적 채우기 (이벤트와 무관) ----
  // 풀을 한 바퀴 다 돈 뒤부터는 pass별 한정어를 붙여 중복을 막는다.
  const cursors = new Map<string, number>()
  const walk = (poolKey: string, pool: string[]): string => {
    const i = cursors.get(poolKey) ?? 0
    cursors.set(poolKey, i + 1)
    const base = pool[i % pool.length]
    const pass = Math.floor(i / pool.length)
    return pass === 0 ? base : `${base} ${PASS_QUALIFIERS[(pass - 1) % PASS_QUALIFIERS.length]}`
  }

  const pickFill = (
    slot: 0 | 1,
    ord: number,
    month: number,
  ): { phrase: string; category: Category } => {
    if (slot === 0) {
      const cat = FILL_ROTATION[ord % FILL_ROTATION.length]
      if (cat === 'seasonal') {
        const south = ord % 9 === 4 ? SOUTHERN_COUNTER_SEASON[month] : undefined
        return {
          phrase: south
            ? walk(`south-${month}`, south)
            : walk(`season-${month}`, SEASONAL_BY_MONTH[month]),
          category: 'seasonal',
        }
      }
      return { phrase: walk(`cat-${cat}`, CATEGORY_POOLS[cat]), category: cat }
    }
    // 배경 슬롯: 1/3만 디자인 배경, 2/3는 다른 카테고리 보조 주제 → 반복 최소화.
    // 슬롯0과 같은 풀은 같은 커서를 공유해 풀 안에서 중복이 생기지 않게 한다.
    if (ord % 3 === 0) {
      return { phrase: walk('cat-design', CATEGORY_POOLS.design), category: 'design' }
    }
    const cat = FILL_ROTATION[(ord + 5) % FILL_ROTATION.length]
    if (cat === 'seasonal') {
      return {
        phrase: walk(`season-${month}`, SEASONAL_BY_MONTH[month]),
        category: 'seasonal',
      }
    }
    return { phrase: walk(`cat-${cat}`, CATEGORY_POOLS[cat]), category: cat }
  }

  for (const date of dates) {
    const month = Number(date.slice(5, 7))
    const ord = ordinalOfDate(date)
    const slots: SeedKeyword[] = ([0, 1] as const).map((slot) => {
      const { phrase, category } = pickFill(slot, ord, month)
      return { productionDate: date, keyword: makeUnique(phrase, used), category }
    })
    bySlot.set(date, slots)
  }

  // ---- Phase 2: 이벤트가 자기 제작일의 두 슬롯을 덮어쓴다 ----
  const startYear = Number(startIso.slice(0, 4))
  const events = eventSeeds(windowSet, [startYear, startYear + 1, startYear + 2]).sort(
    (a, b) =>
      a.productionDate.localeCompare(b.productionDate) ||
      a.keyword.localeCompare(b.keyword),
  )
  const evByDate = new Map<string, SeedKeyword[]>()
  for (const e of events) {
    const arr = evByDate.get(e.productionDate) ?? []
    if (arr.length < 2) arr.push(e)
    evByDate.set(e.productionDate, arr)
  }
  for (const [date, evs] of evByDate) {
    const replaced = evs.map((e) => ({
      productionDate: date,
      keyword: makeUnique(e.keyword, used),
      category: e.category,
      event: e.event,
      targetDate: e.targetDate,
    }))
    if (replaced.length === 2) bySlot.set(date, replaced)
    else bySlot.set(date, [replaced[0], bySlot.get(date)![1]])
  }

  return dates.flatMap((d) => bySlot.get(d)!)
}

export function buildDefaultStockPlan(
  startIso: string = todayLocalIso(),
  days: number = DEFAULT_DAYS,
): SeedRow[] {
  return buildDefaultStockPlanDetailed(startIso, days).map(
    ({ productionDate, keyword }) => ({ productionDate, keyword }),
  )
}
