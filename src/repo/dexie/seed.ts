import { db } from './db'
import type { Repository } from '../types'
import { buildDefaultStockPlan, todayLocalIso } from '../../data/defaultStockKeywords'
import { planPurpose } from '../../domain/planPurpose'

/**
 * 첫 실행 데이터: 기본 "2027 Stock Keywords" 팩 — 오늘부터 365일 × 하루 2개
 * (~2개월 선행 제작 계획), 모든 작업 상태 FALSE.
 *
 * 두 개의 독립된 경로:
 *
 *  1. `runSeedOnce` (기존, `seed:marker`) — 빈 DB(모든 빌드)에 기본 Plan을
 *     생성하거나, 개발 브라우저(`import.meta.env.DEV` 한정)의 낡은 샘플을
 *     지우고 다시 시딩한다. 프로덕션 + 기존 데이터는 여전히 손대지 않는다.
 *  2. `ensureDefaultPack` (신규, `seed:defaultPack`) — **순수 추가(additive)
 *     전용, 절대 삭제하지 않음.** production 브라우저가 이 팩이 생기기 전에
 *     이미 다른 Plan을 갖고 있어서 (1)이 영구히 건너뛰어진 경우를 위한 것.
 *     이름이 정확히 일치하는 "2027 Stock Keywords"(purpose: stock) Plan이
 *     하나도 없으면 딱 한 번 만들어 추가한다 — 기존 Plan은 무엇이든(다른
 *     이름의 Stock Plan이든 General Planner Plan이든) 절대 건드리지 않는다.
 *     코드로 "레거시 샘플"임을 확정할 수 없는 Plan을 지우는 로직은 의도적으로
 *     넣지 않았다 — docs/DECISIONS.md 참고.
 */
const SEED_MARKER_KEY = 'seed:marker'
// 키워드 팩을 단어 위주로 교체 → 마커 상향(개발 브라우저 재시딩 트리거).
const SEED_VERSION = 'rolling-365-v2'
const SEED_PLAN_NAME = '2027 Stock Keywords'

const DEFAULT_PACK_MARKER_KEY = 'seed:defaultPack'
const DEFAULT_PACK_VERSION = 'stock-default-pack:2027:v1'

async function createDefaultPlan(repo: Repository) {
  // createPlan 이 기본 상태 컬럼(생성 / 미캔)을 함께 시딩한다.
  const plan = await repo.createPlan({ name: SEED_PLAN_NAME, type: '365', purpose: 'stock' })
  const rows = buildDefaultStockPlan(todayLocalIso())
  await repo.createKeywords(
    rows.map((r) => ({ planId: plan.id, period: r.productionDate, keyword: r.keyword })),
  )
  // keywordStatus 행을 만들지 않음 → 모든 상태(생성 / 미캔 / 사용자 정의) = FALSE.
  return plan
}

/** 개발 전용. 모든 테이블을 비워 기본 팩이 샘플 데이터를 대체할 수 있게 한다. */
async function devClearAll(): Promise<void> {
  await Promise.all([
    db.plans.clear(),
    db.keywords.clear(),
    db.statusColumns.clear(),
    db.keywordStatus.clear(),
    db.generators.clear(),
    db.settings.clear(),
  ])
}

export async function runSeedOnce(repo: Repository): Promise<void> {
  const marker = await repo.getSetting<string>(SEED_MARKER_KEY)
  if (marker !== SEED_VERSION) {
    const plans = await repo.listPlans()

    if (plans.length === 0) {
      await createDefaultPlan(repo)
    } else if (import.meta.env.DEV) {
      // 개발 머신 한정: 초기 샘플 Plan/Keyword/상태를 교체.
      await devClearAll()
      await createDefaultPlan(repo)
    }
    // 프로덕션 빌드 + 기존 데이터: 손대지 않음.

    await repo.setSetting(SEED_MARKER_KEY, SEED_VERSION)
  }

  // 위 경로가 (기존 데이터가 있는 프로덕션에서는 의도적으로) 아무것도 만들지
  // 않았을 수 있으므로, 별도 마커로 "기본 팩이 존재하는지"만 한 번 더 보장한다.
  await ensureDefaultPack(repo)
}

/**
 * 어떤 Plan이 이미 있든(다른 이름의 Stock Plan, General Planner Plan 등) 절대
 * 건드리지 않고, "2027 Stock Keywords" Plan이 없을 때만 추가한다. 기존 Plan을
 * 지우는 코드는 없다 — docs/DECISIONS.md의 이유 참고.
 *
 * 새로 만든 Plan을 활성 Plan으로 강제 전환하지 않는다: `main.tsx`가 seeding을
 * 기다리지 않고 즉시 렌더링을 시작하므로(빈 DB 사용자의 최초 로딩을 막지
 * 않기 위해), App.tsx의 활성 Plan 결정 effect가 다른 기존 Plan을 이미
 * 골라버린 뒤에 여기서 설정을 덮어써도 반영되지 않는 경쟁 상태가 생긴다.
 * (그 effect는 한 번 유효한 activePlanId를 고르면 그 Plan이 남아 있는 한
 * 다시 평가하지 않는다.) 이 Plan은 계획 선택 드롭다운에 나타나 사용자가
 * 고를 수 있다 — "정상 표시"의 최소 요구는 이것으로 충분하고, 전체 앱의
 * 활성 Plan 판단 로직을 이번 작업 범위에서 건드리지 않는다.
 */
async function ensureDefaultPack(repo: Repository): Promise<void> {
  const marker = await repo.getSetting<string>(DEFAULT_PACK_MARKER_KEY)
  if (marker === DEFAULT_PACK_VERSION) return

  const plans = await repo.listPlans()
  const alreadyExists = plans.some(
    (p) => p.name === SEED_PLAN_NAME && planPurpose(p) === 'stock',
  )
  if (!alreadyExists) {
    await createDefaultPlan(repo)
  }

  await repo.setSetting(DEFAULT_PACK_MARKER_KEY, DEFAULT_PACK_VERSION)
}

/** 전체 로컬 데이터 삭제 후 리로드. 데이터 처리 안내 모달이 안내하는 콘솔 명령. */
export async function __wipeAllData(): Promise<void> {
  await devClearAll()
  location.reload()
}
