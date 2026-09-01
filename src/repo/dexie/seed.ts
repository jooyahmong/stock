import { db } from './db'
import type { Repository } from '../types'
import { buildDefaultStockPlan, todayLocalIso } from '../../data/defaultStockKeywords'

/**
 * 첫 실행 데이터: 기본 "365 스톡 키워드" 팩 — 오늘부터 365일 × 하루 2개
 * (~2개월 선행 제작 계획), 모든 작업 상태 FALSE.
 *
 * 명확히 분리된 두 경로:
 *
 *  - 빈 DB(모든 빌드): 기본 Plan 생성. 어디서나 안전.
 *  - 개발용 초기화(오직 `import.meta.env.DEV`): 개발 브라우저에 이전 임시 샘플
 *    데이터가 남아 있으면(구 seed 마커 + 일부 Plan 존재) 전체를 비우고 다시
 *    시딩. 프로덕션 빌드에서는 절대 실행되지 않으므로, seed 버전 상향만으로
 *    실제 사용자 데이터가 삭제되지 않는다.
 */
const SEED_MARKER_KEY = 'seed:marker'
// 키워드 팩을 단어 위주로 교체 → 마커 상향(개발 브라우저 재시딩 트리거).
const SEED_VERSION = 'rolling-365-v2'
const SEED_PLAN_NAME = '365 스톡 키워드'

async function createDefaultPlan(repo: Repository): Promise<void> {
  // createPlan 이 기본 상태 컬럼(생성 / 미캔)을 함께 시딩한다.
  const plan = await repo.createPlan({ name: SEED_PLAN_NAME, type: '365' })
  const rows = buildDefaultStockPlan(todayLocalIso())
  await repo.createKeywords(
    rows.map((r) => ({ planId: plan.id, period: r.productionDate, keyword: r.keyword })),
  )
  // keywordStatus 행을 만들지 않음 → 모든 상태(생성 / 미캔 / 사용자 정의) = FALSE.
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
  if (marker === SEED_VERSION) return

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

/** 수동 개발 헬퍼 — 전체 테이블 삭제 후 리로드 (main.tsx 참조). */
export async function __wipeAllData(): Promise<void> {
  await devClearAll()
  location.reload()
}
