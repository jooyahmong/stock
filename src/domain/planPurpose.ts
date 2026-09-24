import type { Plan, PlanPurpose } from '../repo/types'

/**
 * Resolves a plan's purpose, defaulting missing/legacy data to `'stock'`.
 * Always read purpose through this helper rather than `plan.purpose` directly
 * so old plans (created before this field existed) keep working unchanged.
 */
export function planPurpose(plan: Pick<Plan, 'purpose'> | null | undefined): PlanPurpose {
  return plan?.purpose === 'planner' ? 'planner' : 'stock'
}

export function isPlannerPlan(plan: Pick<Plan, 'purpose'> | null | undefined): boolean {
  return planPurpose(plan) === 'planner'
}

/** Default seeded StatusColumn names, by purpose. Order matters. */
export const DEFAULT_STATUS_NAMES_BY_PURPOSE: Record<PlanPurpose, readonly string[]> = {
  stock: ['생성', '미캔'],
  planner: ['완료'],
}

/** Excel item-column header/aliases: "Keyword" for stock, "Task" for planner. */
export function itemLabelFor(purpose: PlanPurpose): 'Keyword' | 'Task' {
  return purpose === 'planner' ? 'Task' : 'Keyword'
}

/** What a single plan row is called in plain language, for UI copy. */
export function itemNounFor(purpose: PlanPurpose): '키워드' | '할 일' {
  return purpose === 'planner' ? '할 일' : '키워드'
}
