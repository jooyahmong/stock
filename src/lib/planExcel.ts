import type { Plan, PlanSnapshot, StatusColumn } from '../repo/types'
import { periodKind } from '../domain/periods'
import { planPurpose, itemLabelFor } from '../domain/planPurpose'
import { buildTemplateWorkbook, buildFullExportWorkbook } from '../domain/excel'
import { downloadBlob } from './download'

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'plan'
}

/** Starter sheet for the active (date) plan — same columns as Full Export. */
export function downloadTemplate(plan: Plan, statusColumns: StatusColumn[]): void {
  const cols = [...statusColumns].sort((a, b) => a.order - b.order)
  const purpose = planPurpose(plan)
  downloadBlob(
    buildTemplateWorkbook(periodKind(plan.type), cols, itemLabelFor(purpose)),
    purpose === 'planner' ? 'planner-template.xlsx' : 'stock-template.xlsx',
    XLSX_MIME,
  )
}

export function downloadFullExport(plan: Plan, snapshot: PlanSnapshot): void {
  const purpose = planPurpose(plan)
  const bytes = buildFullExportWorkbook({
    kind: periodKind(plan.type),
    keywords: snapshot.keywords,
    statusColumns: snapshot.statusColumns,
    statusMap: snapshot.statusMap,
    itemLabel: itemLabelFor(purpose),
    sheetName: purpose === 'planner' ? 'Planner' : 'Stock Plan',
  })
  downloadBlob(bytes, `${safeName(plan.name)}-full-export.xlsx`, XLSX_MIME)
}
