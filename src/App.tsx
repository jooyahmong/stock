import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRepoQuery, useRepository } from './repo/RepositoryContext'
import { useUiStore } from './store/uiStore'
import { ACTIVE_PLAN_KEY } from './lib/settingsKeys'
import {
  periodKind,
  isValidPeriod,
  defaultNewPeriod,
  periodColumnLabel,
  periodNoun,
  currentPeriod,
} from './domain/periods'
import { groupKeywords } from './domain/grouping'
import { findGeneratedColumn } from './domain/statusColumns'
import { downloadTemplate, downloadFullExport } from './lib/planExcel'
import { openGptWindow } from './lib/clipboard'
import { isAllowedGptUrl } from './lib/gptUrl'
import { readViewMode, writeViewMode, type ViewMode } from './lib/viewModePref'

import { Toast } from './components/Toast'
import { PlanBar } from './components/PlanBar'
import { ViewToggle } from './components/ViewToggle'
import { Toolbar } from './components/Toolbar'
import { SelectionBar } from './components/SelectionBar'
import { ProgressPanel } from './components/ProgressPanel'
import { PeriodGroup } from './components/PeriodGroup'
import { CalendarView } from './components/calendar/CalendarView'
import {
  DEFAULT_LIST_WINDOW,
  getListView,
  type ListWindowState,
} from './components/ListWindow'
import { PromptDialog } from './components/PromptDialog'
import { Modal } from './components/Modal'
import { ImportPreviewModal } from './components/ImportPreviewModal'
import { SettingsModal } from './components/settings/SettingsModal'
import { useRunKeyword } from './hooks/useRunKeyword'
import {
  directGenerationEnabled,
  useGenerationConfig,
  GenerateModal,
} from './generation'

const EXTRA_PERIODS_KEY = (planId: string) => `plan:${planId}:extraPeriods`

export default function App() {
  const repo = useRepository()

  const activePlanId = useUiStore((s) => s.activePlanId)
  const setActivePlanId = useUiStore((s) => s.setActivePlanId)

  const { data: plans } = useRepoQuery((r) => r.listPlans(), [])
  const { data: storedActive } = useRepoQuery(
    (r) => r.getSetting<string>(ACTIVE_PLAN_KEY),
    [],
  )

  // Keep `activePlanId` pointing at a real plan: restore the last one, else the
  // first available. (Plan type is now a property of the plan, not a tab.)
  useEffect(() => {
    if (!plans) return
    if (activePlanId && plans.some((p) => p.id === activePlanId)) return
    const next =
      (storedActive && plans.find((p) => p.id === storedActive)?.id) ??
      plans[0]?.id ??
      null
    setActivePlanId(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, storedActive])

  useEffect(() => {
    if (activePlanId) void repo.setSetting(ACTIVE_PLAN_KEY, activePlanId)
  }, [activePlanId, repo])

  const activePlan = plans?.find((p) => p.id === activePlanId) ?? null

  const { data: snapshot } = useRepoQuery(
    (r) => (activePlanId ? r.getPlanSnapshot(activePlanId) : Promise.resolve(undefined)),
    [activePlanId],
  )
  const { data: extraPeriods } = useRepoQuery(
    (r) =>
      activePlanId
        ? r.getSetting<string[]>(EXTRA_PERIODS_KEY(activePlanId))
        : Promise.resolve(undefined),
    [activePlanId],
  )

  const search = useUiStore((s) => s.search)
  const filter = useUiStore((s) => s.filter)
  const runMyGpt = useRunKeyword()
  const genConfig = useGenerationConfig()
  const { data: generators } = useRepoQuery((r) => r.listGenerators(), [])
  const hasMyGpt = (generators ?? []).some((g) => g.url.trim().length > 0)
  const defaultGpt =
    (generators ?? []).find((g) => g.isDefault && g.url.trim()) ??
    (generators ?? []).find((g) => g.url.trim()) ??
    null

  const openGpt = useCallback(() => {
    if (!defaultGpt || !isAllowedGptUrl(defaultGpt.url)) {
      useUiStore.getState().showToast(
        '먼저 설정 > 생성에서 생성 사이트 주소를 저장하세요.',
        'error',
      )
      setShowSettings(true)
      return
    }
    const r = openGptWindow(defaultGpt.url)
    useUiStore.getState().showToast(
      r === 'popup-blocked'
        ? '팝업이 차단되었습니다. 팝업을 허용해주세요.'
        : `${defaultGpt.name} 탭을 열었습니다.`,
      r === 'popup-blocked' ? 'error' : 'info',
    )
  }, [defaultGpt])

  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDataNotice, setShowDataNotice] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [addingPeriod, setAddingPeriod] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null)
  const [generateFor, setGenerateFor] = useState<{ keyword: string; id: string } | null>(
    null,
  )
  const [viewMode, setViewModeState] = useState<ViewMode>(readViewMode)
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    writeViewMode(mode)
  }, [])
  const [listWindow, setListWindow] = useState<ListWindowState>(DEFAULT_LIST_WINDOW)
  useEffect(() => setListWindow(DEFAULT_LIST_WINDOW), [activePlanId])
  const [today, setToday] = useState(() => currentPeriod('date'))
  useEffect(() => {
    const refresh = () => setToday(currentPeriod('date'))
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const kind = activePlan ? periodKind(activePlan.type) : 'date'
  const calendarAvailable = kind === 'date'

  const grouping = useMemo(() => {
    if (!snapshot) return null
    const known = new Set<string>(snapshot.keywords.map((k) => k.period))
    for (const p of extraPeriods ?? []) known.add(p)
    return groupKeywords(snapshot.keywords, {
      kind,
      search,
      filter,
      statusMap: snapshot.statusMap,
      knownPeriods: [...known],
    })
  }, [snapshot, extraPeriods, kind, search, filter])

  // Keep today first; past work stays available separately, including in search.
  const listView = useMemo(
    () => getListView(
      grouping?.groups ?? [],
      kind === 'date' ? today : currentPeriod(kind),
      listWindow,
      grouping?.filtering ?? false,
    ),
    [grouping, listWindow, kind, today],
  )

  // "전체 선택" targets the keywords currently on screen (list window +
  // search/filter), never hidden ones.
  const selection = useUiStore((s) => s.selection)
  const selectMany = useUiStore((s) => s.selectMany)
  const visibleKeywordIds = useMemo(
    () => [...listView.visible, ...(listView.showPast ? listView.past : [])]
      .flatMap((g) => g.items.map((i) => i.id)),
    [listView],
  )
  const allVisibleSelected =
    visibleKeywordIds.length > 0 &&
    visibleKeywordIds.every((id) => selection.has(id))

  const generationMode = directGenerationEnabled
    ? genConfig.defaultGenerationMode
    : 'my-gpt'

  const onRun = useCallback(
    (keyword: string, keywordItemId: string) => {
      if (generationMode === 'direct') {
        setGenerateFor({ keyword, id: keywordItemId })
      } else {
        runMyGpt(keyword, () => setShowSettings(true))
      }
    },
    [generationMode, runMyGpt],
  )

  // Direct Generate success -> auto-check the "생성" column (principle 6).
  const autoCheckGenerated = useCallback(
    (keywordItemId: string) => {
      if (!snapshot) return
      const col = findGeneratedColumn(snapshot.statusColumns)
      if (col) {
        void repo.setKeywordStatus(keywordItemId, col.id, true)
        useUiStore.getState().showToast('이미지 생성 완료 · "생성" 체크됨')
      }
    },
    [snapshot, repo],
  )

  const addPeriod = async (raw: string) => {
    if (!activePlanId) return
    if (!isValidPeriod(kind, raw)) {
      useUiStore.getState().showToast(
        `형식이 올바르지 않습니다 (${periodColumnLabel(kind)}).`,
        'error',
      )
      return
    }
    const list = new Set(extraPeriods ?? [])
    list.add(raw.trim())
    await repo.setSetting(EXTRA_PERIODS_KEY(activePlanId), [...list])
    if (raw.trim() < currentPeriod(kind)) {
      setListWindow((w) => ({ ...w, past: true }))
    }
    setAddingPeriod(false)
  }

  const renamePeriod = async (from: string, to: string) => {
    if (!activePlanId || !snapshot) return
    if (!isValidPeriod(kind, to)) {
      useUiStore.getState().showToast('형식이 올바르지 않습니다.', 'error')
      return
    }
    const affected = snapshot.keywords.filter((k) => k.period === from)
    for (const k of affected) await repo.updateKeyword(k.id, { period: to.trim() })
    const list = new Set(extraPeriods ?? [])
    if (list.has(from)) {
      list.delete(from)
      list.add(to.trim())
      await repo.setSetting(EXTRA_PERIODS_KEY(activePlanId), [...list])
    }
    setEditingPeriod(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <img className="app-logo" src="/logo.png" alt="WOOJOO Stock Planner" />
        <span className="app-sub">
          오늘도 생각만 하고 실천하지 못한 나를 위한 365일 스톡 진행 플래너
        </span>
      </header>

      <PlanBar plans={plans ?? []} activePlan={activePlan} />

      {!activePlan && (
        <div className="empty-state">
          <p>계획이 없습니다.</p>
          <p className="hint">
            상단의 <b>+ 새 계획</b>으로 만들거나, 계획을 만든 뒤 Excel을 Import 하세요.
          </p>
        </div>
      )}

      {activePlan && snapshot && grouping && (
        <>
          <ViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            calendarAvailable={calendarAvailable}
          />

          {viewMode === 'calendar' ? (
            <CalendarView
              keywords={snapshot.keywords}
              statusColumns={snapshot.statusColumns}
              statusMap={snapshot.statusMap}
              dateBased={calendarAvailable}
              onRun={onRun}
              onSwitchToList={() => setViewMode('list')}
            />
          ) : (
            <>
              <Toolbar
                snapshot={snapshot}
                onOpenImport={() => setShowImport(true)}
                onOpenSettings={() => setShowSettings(true)}
                onAddPeriod={() => setAddingPeriod(true)}
                periodNoun={periodNoun(kind)}
                onDownloadTemplate={() => downloadTemplate(activePlan, snapshot.statusColumns)}
                onFullExport={() => {
                  downloadFullExport(activePlan, snapshot)
                  useUiStore.getState().showToast('Full Export 파일을 내려받았습니다.')
                }}
                onOpenGpt={
                  generationMode === 'my-gpt' && hasMyGpt ? openGpt : undefined
                }
                visibleCount={visibleKeywordIds.length}
                allVisibleSelected={allVisibleSelected}
                onToggleSelectAllVisible={(checked) =>
                  selectMany(visibleKeywordIds, checked)
                }
              />

              <SelectionBar snapshot={snapshot} />
              <ProgressPanel snapshot={snapshot} />

              <main className="groups">
                {grouping.groups.length === 0 && (
                  <p className="empty-state">
                    {grouping.filtering
                      ? '조건에 맞는 키워드가 없습니다.'
                      : '키워드가 없습니다. "+ 기간 추가" 후 키워드를 입력하거나 Excel을 Import 하세요.'}
                  </p>
                )}
                {listView.visible.map((g) => (
                  <PeriodGroup
                    key={g.period}
                    group={g}
                    statusColumns={snapshot.statusColumns.filter((c) => c.isVisible)}
                    statusMap={snapshot.statusMap}
                    onRun={onRun}
                    onEditPeriod={setEditingPeriod}
                  />
                ))}
                {!grouping.filtering && listView.visible.length === 0 && listView.past.length > 0 && (
                  <p className="empty-state">오늘 이후의 일정이 없습니다. 지난 날짜를 펼쳐 작업을 확인하세요.</p>
                )}
                {listView.windowed && !listWindow.all && !listView.atEnd && (
                  <button
                    className="list-more-btn"
                    onClick={() =>
                      setListWindow((w) => ({ ...w, after: w.after + 14 }))
                    }
                  >
                    이후 더 보기 ▼
                  </button>
                )}
                {listView.windowed && (
                  <button
                    className="list-all-toggle"
                    onClick={() =>
                      setListWindow((w) =>
                        w.all ? DEFAULT_LIST_WINDOW : { ...w, all: true },
                      )
                    }
                  >
                    {listWindow.all
                      ? '오늘부터 보기'
                      : `전체 ${grouping.groups.length}일 보기`}
                  </button>
                )}
                {listView.past.length > 0 && (
                  <section className="past-dates" aria-label="지난 날짜">
                    {grouping.filtering || listWindow.all ? (
                      <h2 className="past-dates-title">지난 날짜 · {listView.past.length}일</h2>
                    ) : (
                      <button
                        className="list-all-toggle"
                        aria-expanded={listView.showPast}
                        aria-controls="past-date-groups"
                        onClick={() => setListWindow((w) => ({ ...w, past: !w.past }))}
                      >
                        지난 날짜 {listView.showPast ? '접기' : '보기'} · {listView.past.length}일
                      </button>
                    )}
                    <div id="past-date-groups">
                      {listView.showPast && listView.past.map((g) => (
                        <PeriodGroup
                          key={g.period}
                          group={g}
                          statusColumns={snapshot.statusColumns.filter((c) => c.isVisible)}
                          statusMap={snapshot.statusMap}
                          onRun={onRun}
                          onEditPeriod={setEditingPeriod}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </main>
            </>
          )}
        </>
      )}

      {directGenerationEnabled && generateFor && (
        <GenerateModal
          keyword={generateFor.keyword}
          keywordItemId={generateFor.id}
          hasMyGpt={hasMyGpt}
          onClose={() => setGenerateFor(null)}
          onGeneratedSuccess={autoCheckGenerated}
          onSwitchToMyGpt={(kw) => {
            setGenerateFor(null)
            runMyGpt(kw, () => setShowSettings(true))
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {showImport && activePlan && snapshot && (
        <ImportPreviewModal
          plan={activePlan}
          snapshot={snapshot}
          onClose={() => setShowImport(false)}
        />
      )}

      {showSettings && activePlan && snapshot && (
        <SettingsModal
          plan={activePlan}
          snapshot={snapshot}
          onClose={() => setShowSettings(false)}
          onOpenImport={() => {
            setShowSettings(false)
            setShowImport(true)
          }}
          onDownloadTemplate={() => downloadTemplate(activePlan, snapshot.statusColumns)}
          onFullExport={() => {
            downloadFullExport(activePlan, snapshot)
            useUiStore.getState().showToast('Full Export 파일을 내려받았습니다.')
          }}
        />
      )}

      {addingPeriod && activePlan && (
        <PromptDialog
          title={`${periodNoun(kind)} 추가`}
          label={periodColumnLabel(kind)}
          initialValue={defaultNewPeriod(
            kind,
            snapshot?.keywords.map((k) => k.period) ?? [],
          )}
          placeholder={
            kind === 'week' ? '2027-W03' : kind === 'month' ? '2027-03' : '2027-01-03'
          }
          confirmLabel="추가"
          onCancel={() => setAddingPeriod(false)}
          onConfirm={addPeriod}
        />
      )}

      {editingPeriod && (
        <PromptDialog
          title={`${periodNoun(kind)} 수정`}
          label={`${periodColumnLabel(kind)} — 이 ${periodNoun(kind)}의 모든 키워드가 이동합니다`}
          initialValue={editingPeriod}
          confirmLabel="변경"
          onCancel={() => setEditingPeriod(null)}
          onConfirm={(v) => renamePeriod(editingPeriod, v)}
        />
      )}

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} WOOJOO Stock Planner</span>
        <span aria-hidden>·</span>
        <button className="linkish" onClick={() => setShowHelp(true)}>
          사용법
        </button>
        <span aria-hidden>·</span>
        <button className="linkish" onClick={() => setShowDataNotice(true)}>
          데이터 처리 안내
        </button>
      </footer>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showDataNotice && <DataNoticeModal onClose={() => setShowDataNotice(false)} />}

      <Toast />
    </div>
  )
}

const SAMPLE_VIDEO_URL = 'https://canva.link/b5hfb2is2lz45zd'

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="사용법" onClose={onClose} width={560}>
      <div className="help-body">
        <ol className="help-steps">
          <li>
            <b>키워드 확인</b> — 목록에 오늘 기준 365일 스톡 키워드가 날짜별로
            들어 있습니다. 자유롭게 수정·추가(+ 날짜 추가)·삭제하세요.
          </li>
          <li>
            <b>생성 사이트 연결</b> — 설정 → 생성 → 내 생성 사이트에 ChatGPT·Gemini·Midjourney 등의 주소를
            저장합니다. 키워드를 클릭하면 프롬프트가 복사되고 그 링크가 새 탭으로
            열립니다. 거기에 붙여넣어 이미지를 생성하세요(자동 전송은 안 함).
          </li>
          <li>
            <b>진행 체크</b> — 각 키워드의 <b>생성 / 미캔</b> 체크박스로 상태를
            표시합니다. 체크 항목은 설정 → 체크 항목에서 추가할 수 있습니다.
          </li>
          <li>
            <b>달력 보기</b> — 월별 진행 현황. <b>생성</b>을 체크하면 날짜와
            무관하게 바로 <b>○</b>, 지난 날짜인데 미체크면 <b>×</b>.
          </li>
          <li>
            <b>백업</b> — 데이터는 이 브라우저에만 저장됩니다. 툴바의 <b>Full
            Export</b>로 Excel 백업, <b>Import Excel</b>로 복원(같은 날짜+키워드는
            체크값을 덮어씀). <b>Template</b>로 빈 양식을 받을 수 있습니다.
          </li>
        </ol>

        <section className="help-gpts">
          <h4>생성 사이트 이용 안내</h4>
          <ul>
            <li>
              각 사이트에 본인 계정으로 로그인해 사용하세요. 이용 가능한 기능과
              요금은 해당 사이트의 정책과 가입한 요금제에 따라 달라집니다.
            </li>
            <li>
              샘플 영상에 쓰인 GPTs 지침 예시:
              <blockquote className="help-quote">
                키워드를 치면 심플한 2D 벡터 스타일의 그림을 그려주세요. 그림자
                없기, 하얀 배경.
              </blockquote>
            </li>
          </ul>
        </section>

        <section className="help-sample">
          <h4>샘플 영상</h4>
          {/* 680×926 세로 영상 자리. 나중에 iframe 임베드로 교체 가능. */}
          <a
            className="help-sample-frame"
            href={SAMPLE_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>▶ 샘플 영상 보기 (Canva)</span>
          </a>
        </section>
      </div>
    </Modal>
  )
}

function DataNoticeModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="데이터 처리 안내" onClose={onClose} width={520}>
      <ul className="data-notice">
        <li>이 앱은 로그인·서버 계정이 없습니다.</li>
        <li>
          계획·키워드·작업 상태·설정은 모두 이 브라우저(IndexedDB / localStorage)에만
          저장됩니다.
        </li>
        <li>계획·키워드 데이터를 우리 서버로 전송·수집하지 않습니다.</li>
        <li>
          {directGenerationEnabled ? (
            <>
              생성 사이트 링크와 Direct Generate API Key도 이 브라우저에만 저장됩니다.
              링크 방식은 프롬프트를 복사하고 사이트를 열며, 직접 붙여넣어 사용합니다.
              Direct Generate는 설정한 API 제공자에게 프롬프트를 전송합니다.
            </>
          ) : (
            <>
              생성 사이트 링크도 이 브라우저에만 저장됩니다. 키워드를 클릭하면
              프롬프트를 복사하고 해당 사이트를 엽니다. 프롬프트는 자동 전송되지
              않으며, 사용자가 직접 붙여넣어 사용합니다.
            </>
          )}
        </li>
        <li>
          모든 데이터를 지우려면 브라우저의 사이트 데이터 삭제, 또는 개발자
          콘솔에서 <code>__wipeAllData()</code> 를 실행하세요(즉시 삭제 후 새로고침).
        </li>
        <li>
          향후 로그인·클라우드 저장, 광고(Google AdSense 등) 등 제3자 서비스가
          추가되면 그에 맞는 이용약관·개인정보처리방침을 별도로 게시합니다.
        </li>
      </ul>
    </Modal>
  )
}
