import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRepoQuery, useRepository } from './repo/RepositoryContext'
import { useUiStore } from './store/uiStore'
import { ACTIVE_PLAN_KEY } from './lib/settingsKeys'
import {
  periodKind,
  isValidPeriod,
  defaultNewPeriod,
  periodColumnLabel,
  currentPeriod,
} from './domain/periods'
import { groupKeywords } from './domain/grouping'
import { findGeneratedColumn } from './domain/statusColumns'
import { downloadTemplateFor, downloadFullExport } from './lib/planExcel'
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
        '먼저 설정 > 생성에서 My GPT 링크를 저장하세요.',
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

  // List-view windowing: a full-year plan is too long, so show a slice around
  // "today" with expand controls. Bypassed while searching / filtering.
  const listView = useMemo(() => {
    const groups = grouping?.groups ?? []
    const canWindow =
      !!grouping &&
      !grouping.filtering &&
      groups.length > listWindow.before + listWindow.after
    if (!canWindow) return { visible: groups, windowed: false, atEnd: true }
    if (listWindow.all) return { visible: groups, windowed: true, atEnd: true }

    const anchor = currentPeriod(kind)
    let startIdx = groups.findIndex((g) => g.period >= anchor)
    if (startIdx === -1) startIdx = groups.length
    const lo = Math.max(0, startIdx - listWindow.before)
    const hi = Math.min(groups.length, startIdx + listWindow.after)
    return {
      visible: groups.slice(lo, hi),
      windowed: true,
      atEnd: hi >= groups.length,
    }
  }, [grouping, listWindow, kind])

  // "전체 선택" targets the keywords currently on screen (list window +
  // search/filter), never hidden ones.
  const selection = useUiStore((s) => s.selection)
  const selectMany = useUiStore((s) => s.selectMany)
  const visibleKeywordIds = useMemo(
    () => listView.visible.flatMap((g) => g.items.map((i) => i.id)),
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
                onDownloadTemplate={() => downloadTemplateFor(activePlan)}
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
                      ? '최근 날짜만 보기'
                      : `전체 ${grouping.groups.length}일 보기`}
                  </button>
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
          onDownloadTemplate={() => downloadTemplateFor(activePlan)}
          onFullExport={() => {
            downloadFullExport(activePlan, snapshot)
            useUiStore.getState().showToast('Full Export 파일을 내려받았습니다.')
          }}
        />
      )}

      {addingPeriod && activePlan && (
        <PromptDialog
          title="기간 추가"
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
          title="기간 수정"
          label={`${periodColumnLabel(kind)} — 이 기간의 모든 키워드가 이동합니다`}
          initialValue={editingPeriod}
          confirmLabel="변경"
          onCancel={() => setEditingPeriod(null)}
          onConfirm={(v) => renamePeriod(editingPeriod, v)}
        />
      )}

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} WOOJOO Stock Planner</span>
        <span aria-hidden>·</span>
        <button className="linkish" onClick={() => setShowDataNotice(true)}>
          데이터 처리 안내
        </button>
      </footer>

      {showDataNotice && <DataNoticeModal onClose={() => setShowDataNotice(false)} />}

      <Toast />
    </div>
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
              My GPT 링크와 Direct Generate API Key도 이 브라우저에만 저장됩니다.
              키워드 클릭 시 사용자가 지정한 GPT / OpenAI 주소로만 직접 요청이
              전송됩니다.
            </>
          ) : (
            <>
              My GPT 링크도 이 브라우저에만 저장됩니다. 키워드 클릭 시 사용자가
              지정한 GPT 주소로만 직접 요청이 전송됩니다.
            </>
          )}
        </li>
        <li>
          데이터를 지우려면 브라우저의 사이트 데이터 삭제, 또는 개발자 콘솔에서{' '}
          <code>__wipeAllData()</code> 를 실행하세요.
        </li>
        <li>
          향후 로그인·클라우드 저장, 광고(Google AdSense 등) 등 제3자 서비스가
          추가되면 그에 맞는 이용약관·개인정보처리방침을 별도로 게시합니다.
        </li>
      </ul>
    </Modal>
  )
}
