/**
 * 기본 스톡 키워드 팩 — 오늘부터 365일, (월, 일) 사이클로 반복.
 *
 * 격리된 seed dataset (컴포넌트에 하드코딩하지 않음). 이 팩은 추천 일정일 뿐이며,
 * Plan에 시딩된 뒤에는 일반 KeywordItem처럼 자유롭게 수정/삭제할 수 있다.
 *
 *   buildDefaultStockPlan()               // 로컬 오늘부터 365일
 *   buildDefaultStockPlan('2026-09-01')   // 특정 시작일부터 365일
 */
export { buildDefaultStockPlan, buildDefaultStockPlanDetailed } from './buildDefaultStockPlan'
export { EVENT_NAMES } from './events'
export { todayLocalIso } from './dateUtils'
export type { SeedRow, SeedKeyword, Category } from './types'
