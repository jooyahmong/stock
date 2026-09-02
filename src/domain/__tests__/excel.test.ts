import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  parseImportFile,
  buildTemplateWorkbook,
  buildTemplateWorkbookAllKinds,
  buildFullExportWorkbook,
} from '../excel'
import type { KeywordItem, StatusColumn } from '../../repo/types'

function sheetToFile(aoa: unknown[][], name = 'import.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new File([buf], name)
}

const NO_STATUS: Pick<StatusColumn, 'id' | 'name'>[] = []

describe('parseImportFile — minimal Date | Keyword', () => {
  it('parses rows, keeps repeated dates, ignores empty keywords/rows', async () => {
    const file = sheetToFile([
      ['Date', 'Keyword'],
      ['2027-01-01', '떡국'],
      ['2027-01-01', '일출'],
      ['2027-01-01', '복주머니'],
      ['2027-01-02', '겨울여행'],
      ['2027-01-02', ''], // empty keyword -> ignored
      ['', ''], // blank row -> ignored
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.ok).toBe(true)
    expect(preview.rows).toHaveLength(4)
    expect(preview.skippedEmpty).toBe(2)
    expect(preview.newCount).toBe(4)
    expect(preview.rows.filter((r) => r.period === '2027-01-01')).toHaveLength(3)
  })

  it('flags bad date formats as errors, not crashes', async () => {
    const file = sheetToFile([
      ['Date', 'Keyword'],
      ['2027-13-40', 'bad date'],
      ['nope', 'also bad'],
      ['2027-01-03', 'good'],
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.ok).toBe(true)
    expect(preview.errors).toHaveLength(2)
    expect(preview.rows).toHaveLength(1)
  })

  it('matches existing keywords for in-place update; extra copies become new', async () => {
    const file = sheetToFile([
      ['Date', 'Keyword'],
      ['2027-01-01', '떡국'], // matches existing e1 -> update
      ['2027-01-02', '눈사람'], // new
      ['2027-01-02', '눈사람'], // still new (plan has no 눈사람)
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [{ id: 'e1', period: '2027-01-01', keyword: '떡국' }],
      statusColumns: NO_STATUS,
    })
    expect(preview.updateCount).toBe(1)
    expect(preview.newCount).toBe(2)
    expect(preview.rows[0].matchedKeywordId).toBe('e1')
    expect(preview.rows[2].matchedKeywordId).toBeUndefined()
    expect(preview.unmatchedExistingIds).toEqual([])
  })

  it('lists existing keywords no row matched (mirror-delete candidates)', async () => {
    const file = sheetToFile([
      ['Date', 'Keyword'],
      ['2027-01-01', '떡국'],
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [
        { id: 'e1', period: '2027-01-01', keyword: '떡국' },
        { id: 'e2', period: '2027-01-01', keyword: '일출' },
      ],
      statusColumns: NO_STATUS,
    })
    expect(preview.updateCount).toBe(1)
    expect(preview.unmatchedExistingIds).toEqual(['e2'])
  })

  it('fails clearly when the base column is missing', async () => {
    const file = sheetToFile([
      ['Something', 'Keyword'],
      ['x', 'y'],
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.ok).toBe(false)
    expect(preview.fatalError).toMatch(/기준 열/)
  })
})

describe('parseImportFile — extended columns', () => {
  it('matches status headers by name and reads TRUE/FALSE', async () => {
    const cols: Pick<StatusColumn, 'id' | 'name'>[] = [
      { id: 'c1', name: '생성' },
      { id: 'c2', name: '미캔' },
    ]
    const file = sheetToFile([
      ['Date', 'Keyword', '생성', '미캔', 'Adobe Stock'],
      ['2027-01-01', '떡국', 'TRUE', 'FALSE', 'TRUE'],
      ['2027-01-01', '일출', '1', '✓', ''],
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: cols,
    })
    expect(preview.recognizedStatusHeaders).toEqual(['생성', '미캔'])
    expect(preview.unknownStatusHeaders).toEqual(['Adobe Stock'])
    // Both checked AND unchecked recorded, so re-import applies un-checks.
    expect(preview.rows[0].statuses).toEqual({ c1: true, c2: false })
    expect(preview.rows[1].statuses).toEqual({ c1: true, c2: true })
    expect(preview.recognizedStatusColumnIds).toEqual(['c1', 'c2'])
  })

  it('an existing keyword row carries its sheet check values for update', async () => {
    const cols: Pick<StatusColumn, 'id' | 'name'>[] = [{ id: 'c1', name: '생성' }]
    const file = sheetToFile([
      ['Date', 'Keyword', '생성'],
      ['2027-01-01', '떡국', 'FALSE'], // was checked before; sheet un-checks it
    ])
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [{ id: 'e1', period: '2027-01-01', keyword: '떡국' }],
      statusColumns: cols,
    })
    expect(preview.rows[0].matchedKeywordId).toBe('e1')
    expect(preview.rows[0].statuses).toEqual({ c1: false })
  })
})

describe('week / month import', () => {
  it('parses weekly sheets', async () => {
    const file = sheetToFile([
      ['Week', 'Keyword'],
      ['2027-W01', 'New Year'],
      ['2027-W1', 'Resolution'],
    ])
    const preview = await parseImportFile(file, {
      kind: 'week',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.rows.map((r) => r.period)).toEqual(['2027-W01', '2027-W01'])
  })
})

describe('template + full export round-trip', () => {
  it('template has the right header for the kind', () => {
    const buf = buildTemplateWorkbook('week')
    const wb = XLSX.read(buf, { type: 'array' })
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    })
    expect(aoa[0]).toEqual(['Week', 'Keyword'])
  })

  it('template includes status columns with FALSE defaults', () => {
    const buf = buildTemplateWorkbook('date', [{ name: '생성' }, { name: '미캔' }])
    const wb = XLSX.read(buf, { type: 'array' })
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    })
    expect(aoa[0]).toEqual(['Date', 'Keyword', '생성', '미캔'])
    expect(aoa[1]).toEqual(['2027-01-01', '떡국', 'FALSE', 'FALSE'])
  })

  it('all-kinds template = one file, Date / Week / Month tabs', () => {
    const buf = buildTemplateWorkbookAllKinds([{ name: '생성' }])
    const wb = XLSX.read(buf, { type: 'array' })
    expect(wb.SheetNames).toEqual(['Date', 'Week', 'Month'])
    const week = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Week'], { header: 1 })
    expect(week[0]).toEqual(['Week', 'Keyword', '생성'])
    expect(week[1]).toEqual(['2027-W01', 'New Year', 'FALSE'])
  })

  it('import reads the tab matching the plan kind from an all-kinds file', async () => {
    const buf = buildTemplateWorkbookAllKinds([])
    const preview = await parseImportFile(new File([buf], 't.xlsx'), {
      kind: 'month',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.ok).toBe(true)
    expect(preview.rows.map((r) => r.period)).toEqual([
      '2027-01',
      '2027-01',
      '2027-02',
    ])
  })

  it('full export writes one row per keyword with TRUE/FALSE and no merged dates', () => {
    const keywords: KeywordItem[] = [
      mkKw('k1', '2027-01-01', '떡국', 0),
      mkKw('k2', '2027-01-01', '일출', 1),
      mkKw('k3', '2027-01-02', '겨울여행', 0),
    ]
    const statusColumns: StatusColumn[] = [
      mkCol('c1', '생성', 0),
      mkCol('c2', '미캔', 1),
    ]
    const statusMap = { 'k1:c1': true, 'k1:c2': true, 'k3:c1': true }
    const buf = buildFullExportWorkbook({
      kind: 'date',
      keywords,
      statusColumns,
      statusMap,
    })
    const wb = XLSX.read(buf, { type: 'array' })
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    })
    expect(aoa[0]).toEqual(['Date', 'Keyword', '생성', '미캔'])
    expect(aoa[1]).toEqual(['2027-01-01', '떡국', 'TRUE', 'TRUE'])
    expect(aoa[2]).toEqual(['2027-01-01', '일출', 'FALSE', 'FALSE'])
    expect(aoa[3]).toEqual(['2027-01-02', '겨울여행', 'TRUE', 'FALSE'])
    // Date value literally repeated (never merged).
    expect(aoa[1][0]).toBe('2027-01-01')
    expect(aoa[2][0]).toBe('2027-01-01')
  })

  it('full export is keyword data only — no credential columns or values', () => {
    const buf = buildFullExportWorkbook({
      kind: 'date',
      keywords: [mkKw('k1', '2027-01-01', '벚꽃 봄소풍', 0)],
      statusColumns: [mkCol('c1', '생성', 0), mkCol('c2', 'Adobe Stock', 1)],
      statusMap: {},
    })
    const wb = XLSX.read(buf, { type: 'array' })
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
    })
    // header is exactly Date | Keyword | <status columns>, nothing else
    expect(aoa[0]).toEqual(['Date', 'Keyword', '생성', 'Adobe Stock'])
    const flat = aoa.flat().join(' ')
    expect(/\b(api[ _-]?key|token|secret|sk-)/i.test(flat)).toBe(false)
  })

  it('exported file can be re-imported (restore path)', async () => {
    const keywords: KeywordItem[] = [mkKw('k1', '2027-01-01', '떡국', 0)]
    const statusColumns: StatusColumn[] = [mkCol('c1', '생성', 0)]
    const buf = buildFullExportWorkbook({
      kind: 'date',
      keywords,
      statusColumns,
      statusMap: { 'k1:c1': true },
    })
    const file = new File([buf], 'roundtrip.xlsx')
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: [{ id: 'c1', name: '생성' }],
    })
    expect(preview.rows).toHaveLength(1)
    expect(preview.rows[0].statuses).toEqual({ c1: true })
  })
})

describe('large import', () => {
  it('handles 1200 rows', async () => {
    const rows: unknown[][] = [['Date', 'Keyword']]
    for (let i = 0; i < 1200; i++) {
      rows.push([`2027-${String((i % 12) + 1).padStart(2, '0')}-01`, `kw-${i}`])
    }
    const file = sheetToFile(rows)
    const preview = await parseImportFile(file, {
      kind: 'date',
      existingKeywords: [],
      statusColumns: NO_STATUS,
    })
    expect(preview.rows).toHaveLength(1200)
  })
})

function mkKw(
  id: string,
  period: string,
  keyword: string,
  sortOrder: number,
): KeywordItem {
  return {
    id,
    workspaceId: 'local',
    planId: 'p1',
    period,
    keyword,
    sortOrder,
    createdAt: '',
    updatedAt: '',
  }
}
function mkCol(id: string, name: string, order: number): StatusColumn {
  return {
    id,
    workspaceId: 'local',
    planId: 'p1',
    name,
    order,
    isVisible: true,
    isDefault: order < 2,
    createdAt: '',
  }
}
