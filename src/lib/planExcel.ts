import type { Plan, PlanSnapshot, StatusColumn } from '../repo/types'
import { periodKind } from '../domain/periods'
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
  downloadBlob(
    buildTemplateWorkbook(periodKind(plan.type), cols),
    'stock-template.xlsx',
    XLSX_MIME,
  )
}

export function downloadFullExport(plan: Plan, snapshot: PlanSnapshot): void {
  const bytes = buildFullExportWorkbook({
    kind: periodKind(plan.type),
    keywords: snapshot.keywords,
    statusColumns: snapshot.statusColumns,
    statusMap: snapshot.statusMap,
  })
  downloadBlob(bytes, `${safeName(plan.name)}-full-export.xlsx`, XLSX_MIME)
}
