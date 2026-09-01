/**
 * Default 1-year stock keyword pack — seed-only types.
 *
 * Core rule: the date shown against a keyword is the *production date* — when
 * the image should be made — which is ~2 calendar months BEFORE the target
 * event/season it prepares for (an image made today sells ~2 months later).
 *
 * These metadata fields (event / category / targetDate) exist only for seed
 * generation & quality checks. They are NOT added to the Repository's
 * KeywordItem — the pack is flattened to `{ productionDate, keyword }` pairs
 * before it ever touches storage.
 */

export type Category =
  | 'seasonal'
  | 'holiday'
  | 'lifestyle'
  | 'business'
  | 'education'
  | 'food'
  | 'design'
  | 'technology'
  | 'health'
  | 'travel'

export interface SeedKeyword {
  /** 'YYYY-MM-DD' — the day the user should produce this image. */
  productionDate: string
  keyword: string
  category: Category
  /** Set when this keyword prepares a specific named event. */
  event?: string
  /** 'YYYY-MM-DD' the event/season this targets (seed metadata only). */
  targetDate?: string
}

/** One flattened row, exactly the shape the Repository consumes. */
export interface SeedRow {
  productionDate: string
  keyword: string
}
