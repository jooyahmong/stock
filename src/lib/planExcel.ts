import type { Plan, PlanSnapshot } from '../repo/types'
import { periodKind } from '../domain/periods'
import { buildTemplateWorkbook, buildFullExportWorkbook } from '../domain/excel'
import { downloadBlob } from './download'

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'plan'
}

export function downloadTemplateFor(plan: Plan): void {
  const kind = periodKind(plan.type)
  downloadBlob(buildTemplateWorkbook(kind), `stock-template-${kind}.xlsx`, XLSX_MIME)
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
