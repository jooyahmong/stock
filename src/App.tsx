import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRepoQuery, useRepository } from './repo/RepositoryContext'
import { useUiStore } from './store/uiStore'
import { ACTIVE_PLAN_KEY, GENERATOR_SELECTION_RESET_KEY } from './lib/settingsKeys'
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
import { planPurpose } from './domain/planPurpose'
import { downloadTemplate, downloadFullExport } from './lib/planExcel'
import { openGptWindow } from './lib/clipboard'
import { isAllowedGptUrl } from './lib/gptUrl'
import { readViewMode, writeViewMode, type ViewMode } from './lib/viewModePref'

import { Toast } from './components/Toast'
import { PlanBar } from './components/PlanBar'
import { PlanSearch } from './components/PlanSearch'
import { ViewToggle } from './components/ViewToggle'
import { Toolbar, PlanActions } from './components/Toolbar'
import { SelectionBar } from './components/SelectionBar'
import { ProgressPanel } from './components/ProgressPanel'
import { PeriodGroup } from './components/PeriodGroup'
import { CalendarView } from './components/calendar/CalendarView'
import { FIRST_AVAILABLE_MONTH, MonthNavigator } from './components/calendar/MonthNavigator'
import { currentMonth } from './domain/calendar'
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
  const resetGeneratorSelection = useRef(false)
  useEffect(() => {
    if (!generators || resetGeneratorSelection.current) return
    resetGeneratorSelection.current = true
    let shouldReset = false
    try {
      shouldReset = localStorage.getItem(GENERATOR_SELECTION_RESET_KEY) !== 'ready'
    } catch {
      return
    }
    if (!shouldReset) return
    void (async () => {
      for (const generator of generators) {
        if (generator.isDefault) await repo.updateGenerator(generator.id, { isDefault: false })
      }
      localStorage.setItem(GENERATOR_SELECTION_RESET_KEY, 'ready')
    })()
  }, [generators, repo])
  const defaultGpt = (generators ?? []).find((g) => g.isDefault && g.url.trim()) ?? null
  const hasMyGpt = defaultGpt !== null

  const openGpt = useCallback(() => {
    if (!defaultGpt || !isAllowedGptUrl(defaultGpt.url)) {
      useUiStore.getState().showToast(
        '먼저 설정 > 생성에서 기본 생성 사이트를 선택하세요.',
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const month = currentMonth()
    return month < FIRST_AVAILABLE_MONTH ? FIRST_AVAILABLE_MONTH : month
  })
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    writeViewMode(mode)
  }, [])
  const [listWindow, setListWindow] = useState<ListWindowState>(DEFAULT_LIST_WINDOW)
  useEffect(() => setListWindow(DEFAULT_LIST_WINDOW), [activePlanId])
  // Plan search "go to result" — Calendar opens that day's detail; List
  // scrolls to and briefly highlights that date's PeriodGroup. Both are
  // nonce-tagged so re-clicking the same result still re-triggers.
  const [focusDayRequest, setFocusDayRequest] = useState<{ dayIso: string; nonce: number } | null>(null)
  const [highlightPeriod, setHighlightPeriod] = useState<{ period: string; nonce: number } | null>(null)
  useEffect(() => {
    if (!highlightPeriod) return
    document.getElementById(`pg-${highlightPeriod.period}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    const timer = window.setTimeout(() => setHighlightPeriod(null), 1600)
    return () => window.clearTimeout(timer)
  }, [highlightPeriod])
  const navigateToPeriod = useCallback(
    (period: string) => {
      setSelectedMonth(period.slice(0, 7))
      if (viewMode === 'calendar') {
        setFocusDayRequest({ dayIso: period, nonce: Date.now() })
      } else {
        setHighlightPeriod({ period, nonce: Date.now() })
      }
    },
    [viewMode],
  )
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
  const purpose = planPurpose(activePlan)
  const isPlanner = purpose === 'planner'

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

  const listGroups = useMemo(
    () => kind === 'date'
      ? (grouping?.groups ?? []).filter((group) => group.period.startsWith(`${selectedMonth}-`))
      : (grouping?.groups ?? []),
    [grouping, kind, selectedMonth],
  )

  // Date-plan lists show every date in the selected month. Past dates stay at the bottom
  // in chronological order so the first day of the month appears first.
  const listView = useMemo(
    () => getListView(
      listGroups,
      kind === 'date' ? today : currentPeriod(kind),
      listWindow,
      (grouping?.filtering ?? false) || calendarAvailable,
      true,
      calendarAvailable,
    ),
    [grouping?.filtering, listGroups, listWindow, kind, today, calendarAvailable],
  )

  // "전체 선택" targets the keywords currently on screen (list window +
  // search/filter), never hidden ones.
  const selection = useUiStore((s) => s.selection)
  const selectMany = useUiStore((s) => s.selectMany)
  const visibleKeywordIds = useMemo(
    () => [...listView.visible, ...((calendarAvailable || listView.showPast) ? listView.past : [])]
      .flatMap((g) => g.items.map((i) => i.id)),
    [calendarAvailable, listView],
  )
  const allVisibleSelected =
    visibleKeywordIds.length > 0 &&
    visibleKeywordIds.every((id) => selection.has(id))

  const generationMode = directGenerationEnabled
    ? genConfig.defaultGenerationMode
    : 'my-gpt'

  // Planner tasks never trigger generation (docs/specs/general-planner.md §7) —
  // planner-purpose components route clicks to editing instead of calling this,
  // but guard here too so a stray call can't slip through.
  const onRun = useCallback(
    (keyword: string, keywordItemId: string) => {
      if (isPlanner) return
      if (generationMode === 'direct') {
        setGenerateFor({ keyword, id: keywordItemId })
      } else {
        runMyGpt(keyword, () => setShowSettings(true))
      }
    },
    [isPlanner, generationMode, runMyGpt],
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
    if (kind !== 'date' && raw.trim() < currentPeriod(kind)) {
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
        {activePlan && snapshot && (
          <PlanSearch
            key={activePlan.id}
            items={snapshot.keywords}
            purpose={purpose}
            onNavigate={navigateToPeriod}
          />
        )}
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
          <div className="plan-view-header">
            <ViewToggle
              viewMode={viewMode}
              onChange={setViewMode}
              calendarAvailable={calendarAvailable}
            />
            <PlanActions
              onOpenImport={() => setShowImport(true)}
              onOpenSettings={() => setShowSettings(true)}
              onAddPeriod={() => { setViewMode('list'); setAddingPeriod(true) }}
              periodNoun={periodNoun(kind)}
              onDownloadTemplate={() => downloadTemplate(activePlan, snapshot.statusColumns)}
              onFullExport={() => {
                downloadFullExport(activePlan, snapshot)
                useUiStore.getState().showToast('Full Export 파일을 내려받았습니다.')
              }}
              onOpenGpt={!isPlanner && generationMode === 'my-gpt' && hasMyGpt ? openGpt : undefined}
            />
          </div>

          {viewMode === 'calendar' ? (
            <CalendarView
              planId={activePlan.id}
              keywords={snapshot.keywords}
              statusColumns={snapshot.statusColumns}
              statusMap={snapshot.statusMap}
              dateBased={calendarAvailable}
              purpose={purpose}
              onRun={onRun}
              onSwitchToList={() => setViewMode('list')}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              focusDayRequest={focusDayRequest}
            />
          ) : (
            <>
              {calendarAvailable && <MonthNavigator month={selectedMonth} onChange={setSelectedMonth} />}
              <Toolbar
                snapshot={snapshot}
                visibleCount={visibleKeywordIds.length}
                allVisibleSelected={allVisibleSelected}
                onToggleSelectAllVisible={(checked) =>
                  selectMany(visibleKeywordIds, checked)
                }
                hideSelection={isPlanner}
              />

              {!isPlanner && <SelectionBar snapshot={snapshot} />}
              <ProgressPanel snapshot={snapshot} />

              <main className="groups">
                {listView.upcomingCount === 0 && listView.past.length === 0 && (
                  <p className="empty-state">
                    {grouping.filtering
                      ? isPlanner
                        ? '조건에 맞는 할 일이 없습니다.'
                        : '조건에 맞는 키워드가 없습니다.'
                      : isPlanner
                        ? '할 일이 없습니다. "+ 날짜 추가" 후 할 일을 입력하거나 Excel을 Import 하세요.'
                        : '키워드가 없습니다. "+ 날짜 추가" 후 키워드를 입력하거나 Excel을 Import 하세요.'}
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
                    purpose={purpose}
                    highlighted={highlightPeriod?.period === g.period}
                  />
                ))}
                {!calendarAvailable && listView.visible.length === 0 && listView.hasPast && (
                  <p className="empty-state">
                    {calendarAvailable ? (
                      <>
                        {grouping.filtering ? '오늘 이후에 조건에 맞는 키워드가 없습니다.' : '오늘 이후의 일정이 없습니다.'}
                        {' '}지난 기록은 <button className="linkish" onClick={() => setViewMode('calendar')}>달력 보기</button>에서 확인하세요.
                      </>
                    ) : '현재 이후의 일정이 없습니다. 지난 기간을 펼쳐 작업을 확인하세요.'}
                  </p>
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
                      : `전체 ${listView.upcomingCount + listView.past.length}일 보기`}
                  </button>
                )}
                {listView.past.length > 0 && (
                  <section className="past-dates" aria-label="지난 날짜">
                    {calendarAvailable || grouping.filtering || listWindow.all ? (
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
                      {(calendarAvailable || listView.showPast) && listView.past.map((g) => (
                        <PeriodGroup
                          key={g.period}
                          group={g}
                          statusColumns={snapshot.statusColumns.filter((c) => c.isVisible)}
                          statusMap={snapshot.statusMap}
                          onRun={onRun}
                          onEditPeriod={setEditingPeriod}
                          purpose={purpose}
                          highlighted={highlightPeriod?.period === g.period}
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
        <span className="footer-copyright">© {new Date().getFullYear()} WOOJOO Stock Planner</span>
        <span className="footer-links">
          <span aria-hidden>·</span>
          <button className="linkish" onClick={() => setShowHelp(true)}>
            사용법
          </button>
          <span aria-hidden>·</span>
          <button className="linkish" onClick={() => setShowDataNotice(true)}>
            데이터 처리 안내
          </button>
        </span>
      </footer>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showDataNotice && <DataNoticeModal onClose={() => setShowDataNotice(false)} />}

      <Toast />
    </div>
  )
}

const HELP_TABS = [
  { id: 'guide', title: '사용 방법', description: '계획부터 생성·백업까지' },
  { id: 'notice', title: '이용 안내', description: '외부 AI 이용과 책임 범위' },
] as const

function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<typeof HELP_TABS[number]['id']>('guide')
  return (
    <Modal title="사용법" onClose={onClose} width={720} contained>
      <div className="generator-steps" role="tablist" aria-label="사용법 메뉴">
        {HELP_TABS.map((item, index) => (
          <button key={item.id} role="tab" id={`help-tab-${item.id}`}
            aria-controls={`help-panel-${item.id}`} aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={`generator-step${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)} onKeyDown={(event) => {
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
                : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : null
              if (next === null) return
              event.preventDefault()
              setTab(HELP_TABS[next].id)
              document.getElementById(`help-tab-${HELP_TABS[next].id}`)?.focus()
            }}>
            <span className="generator-step-number" aria-hidden="true">{index + 1}</span>
            <span><strong>{item.title}</strong><small>{item.description}</small></span>
          </button>
        ))}
      </div>
      <div className="settings-panel help-body" key={tab} role="tabpanel"
        id={`help-panel-${tab}`} aria-labelledby={`help-tab-${tab}`} tabIndex={0}>
        {tab === 'guide' ? (
        <ol className="help-steps">
          <li>
            <b>키워드 확인</b> — 달력이 기본 화면입니다. 날짜별 키워드를 확인하고,
            목록 보기에서는 선택한 달의 모든 날짜를 한 번에 보며
            수정·추가(+ 날짜 추가)·삭제할 수 있습니다.
          </li>
          <li>
            <b>생성 사이트 선택</b> — 설정 → 생성 → 생성 사이트에서
            ChatGPT·Gemini·Midjourney 중 사용할 사이트를 먼저 선택하고 그림 스타일을
            정합니다. 초기에는 아무 사이트도 선택되어 있지 않습니다. 개인 GPTs 등
            다른 사이트는 아래에 이름과 HTTPS 주소를 추가한 뒤 기본으로 선택하세요.
            키워드를 클릭하면 스타일 지시문까지 복사되고 선택한 사이트가 새 탭으로
            열립니다. 붙여넣고 전송해 이미지를 생성하세요.
          </li>
          <li>
            <b>진행 체크</b> — 각 키워드의 <b>생성 / 미캔</b> 체크박스로 상태를
            표시합니다. 체크박스는 목록 보기에서 사용하며, 체크 항목은
            설정 → 체크 항목에서 추가할 수 있습니다.
          </li>
          <li>
            <b>달력 보기</b> — 월별 진행 현황. <b>생성</b>을 체크하면 날짜와
            무관하게 바로 <b>○</b>, 지난 날짜인데 미체크면 <b>×</b>.
          </li>
          <li>
            <b>백업</b> — 데이터는 이 브라우저에만 저장됩니다. 툴바의 <b>Full
            Export</b>를 누르면 모든 날짜·키워드·체크 상태가 담긴 Excel 파일을
            내려받습니다. <b>Template</b>에서는 새로 작성할 수 있는 빈 양식을
            받을 수 있습니다.
          </li>
          <li>
            <b>가져오기</b> — 내려받은 Excel에서 날짜·Keyword·체크값을 수정한 뒤
            <b> Import Excel</b>로 가져오면 플래너에 반영됩니다. 같은 날짜+Keyword는
            기존 항목의 체크값을 갱신하고, 새 조합은 새 항목으로 추가합니다. Excel에서
            삭제하거나 날짜·Keyword를 바꾼 기존 항목까지 파일과 같게 맞추려면 미리보기의
            <b> 파일과 완전히 일치시키기</b>를 선택하세요.
          </li>
        </ol>
        ) : (
        <section className="help-gpts">
          <ul>
            <li>
              <b>개인 계정과 외부 서비스</b> — AI 사이트는 이용자가 본인 계정으로
              직접 로그인해 이용합니다. 이 플래너는 프롬프트 복사와 링크 열기를
              지원하며, 외부 계정의 로그인 정보·비밀번호를 받거나 관리하지 않습니다.
              계정 보안과 이용 내역은 이용자가 관리해야 합니다.
            </li>
            <li>
              <b>요금과 이용 제한</b> — 구독·결제·환불·사용량 제한·계정 정지는 각
              사이트의 정책에 따릅니다. 사이트 연결만으로 유료 기능이나 이미지 생성이
              보장되지 않으며, 관련 문의는 해당 서비스에 직접 해주세요.
            </li>
            <li>
              <b>상업적 이용 조건</b> — 생성물의 판매·광고·스톡 등록 전, 이용자가
              각 AI 사이트의 최신 약관과 본인 요금제의 상업적 이용 허용 범위를 직접
              확인해야 합니다. 출처 표시, 재판매 제한 등 추가 조건과 등록할 스톡
              사이트의 AI 콘텐츠·심사 정책도 확인하세요. 이 플래너는 상업적 이용
              가능 여부나 판매·심사 통과를 보장하지 않습니다.
            </li>
            <li>
              <b>생성 결과와 권리 확인</b> — 제공되는 키워드·스타일은 작업을 돕는
              예시입니다. 생성물의 저작권·상표권·초상권 등 타인의 권리 침해 여부와
              실제 사용에 필요한 허락은 이용자가 확인해야 합니다. 이미지의 품질,
              정확성, 독창성이나 권리 확보를 보장하지 않습니다.
            </li>
            <li>
              <b>입력 정보와 개인정보</b> — 외부 사이트에 붙여넣고 전송한 문구나
              업로드한 자료에는 해당 사이트의 개인정보·콘텐츠 처리 정책이 적용됩니다.
              개인정보, 비밀번호, 고객 자료 등 민감하거나 공개하면 안 되는 정보는
              입력하지 마세요. 저장·학습 활용·공개 범위는 해당 사이트에서 확인하세요.
            </li>
            <li>
              <b>책임 범위</b> — 외부 AI 사이트의 계정 이용·결제·정책 변경·서비스
              장애 또는 이용자의 약관 위반·생성물 사용으로 발생한 문제에 대해,
              운영자에게 귀책사유가 없는 경우 운영자는 책임을 지지 않습니다.
              다만 운영자의 고의·중과실 또는 관련 법령에 따라 배제할 수 없는 책임은
              이 안내로 제한하지 않습니다.
            </li>
          </ul>
          <p className="hint">
            이용 전 공식 약관을 확인하세요:{' '}
            <a href="https://openai.com/policies/terms-of-use/" target="_blank" rel="noopener noreferrer">OpenAI</a>
            {' · '}
            <a href="https://policies.google.com/terms?hl=ko" target="_blank" rel="noopener noreferrer">Google</a>
            {' · '}
            <a href="https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service" target="_blank" rel="noopener noreferrer">Midjourney</a>
            {' · '}그 외 사이트는 해당 서비스의 약관·개인정보처리방침을 확인하세요.
          </p>
        </section>
        )}
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
