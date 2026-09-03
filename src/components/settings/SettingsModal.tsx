import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Plan, PlanSnapshot } from '../../repo/types'
import { Modal } from '../Modal'
import { GeneratorsSettings } from './GeneratorsSettings'
import { ImageStylesSettings } from './ImageStylesSettings'
import { StatusColumnsSettings } from './StatusColumnsSettings'
import {
  directGenerationEnabled,
  useGenerationConfig,
  GenerationModeChooser,
  DirectGenerateSettings,
} from '../../generation'

type Tab = 'generator' | 'stages' | 'storage'
const GENERATOR_STEPS = [
  { id: 'style', title: '그림 스타일', description: '그림의 분위기 정하기' },
  { id: 'site', title: '생성 사이트', description: '그림을 만들 곳 연결하기' },
] as const
type GeneratorStep = typeof GENERATOR_STEPS[number]['id']

export function SettingsModal({
  plan,
  snapshot,
  onClose,
  onOpenImport,
  onDownloadTemplate,
  onFullExport,
}: {
  plan: Plan
  snapshot: PlanSnapshot
  onClose: () => void
  onOpenImport: () => void
  onDownloadTemplate: () => void
  onFullExport: () => void
}) {
  const [tab, setTab] = useState<Tab>('generator')
  const [step, setStep] = useState<GeneratorStep>('style')
  const panelRef = useRef<HTMLDivElement>(null)
  const genCfg = useGenerationConfig()
  const mode = directGenerationEnabled ? genCfg.defaultGenerationMode : 'my-gpt'

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [tab, step, mode])

  function navigateStep(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
      : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : null
    if (next === null) return
    event.preventDefault()
    const id = GENERATOR_STEPS[next].id
    setStep(id)
    document.getElementById(`generator-step-${id}`)?.focus()
  }

  return (
    <Modal title="설정" onClose={onClose} width={720} contained>
      <div className="settings-tabs" role="group" aria-label="설정 메뉴">
        <button
          className={tab === 'generator' ? 'is-active' : ''}
          aria-pressed={tab === 'generator'}
          onClick={() => setTab('generator')}
        >
          생성
        </button>
        <button
          className={tab === 'stages' ? 'is-active' : ''}
          aria-pressed={tab === 'stages'}
          onClick={() => setTab('stages')}
        >
          체크 항목
        </button>
        <button
          className={tab === 'storage' ? 'is-active' : ''}
          aria-pressed={tab === 'storage'}
          onClick={() => setTab('storage')}
        >
          저장 · 백업
        </button>
      </div>

      {tab === 'generator' && mode === 'my-gpt' && (
        <div className="generator-steps" role="tablist" aria-label="생성 설정 단계">
          {GENERATOR_STEPS.map((item, index) => (
            <button key={item.id} role="tab" id={`generator-step-${item.id}`}
              aria-controls={`generator-panel-${item.id}`} aria-selected={step === item.id}
              tabIndex={step === item.id ? 0 : -1}
              className={`generator-step${step === item.id ? ' is-active' : ''}`}
              onClick={() => setStep(item.id)} onKeyDown={(event) => navigateStep(event, index)}>
              <span className="generator-step-number" aria-hidden="true">{index + 1}</span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>
      )}

      <div className="settings-panel" ref={panelRef}>
        {tab === 'generator' && (
          <>
            {directGenerationEnabled && <GenerationModeChooser />}

            {/* 선택한 방식의 설정만 아래에 표시 */}
            {directGenerationEnabled && mode === 'direct' && <DirectGenerateSettings />}

            {mode === 'my-gpt' && (
              <>
                <div className="generator-step-panel" role="tabpanel" id="generator-panel-style"
                  aria-labelledby="generator-step-style" hidden={step !== 'style'} tabIndex={0}>
                  <ImageStylesSettings />
                </div>
                <div className="generator-step-panel" role="tabpanel" id="generator-panel-site"
                  aria-labelledby="generator-step-site" hidden={step !== 'site'} tabIndex={0}>
                  <section className="gs-block">
                    <p className="hint">
                      키워드를 누르면 선택한 스타일 지시문을 복사하고 기본 사이트를 엽니다.
                      열린 사이트에 붙여넣고 전송하세요.
                    </p>
                    <GeneratorsSettings />
                  </section>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'stages' && (
          <>
            <p className="hint">
              계획 <strong className="settings-plan-name">[ {plan.name} ]</strong>의 체크 항목입니다. 왼쪽 체크로 목록 표시 여부를
              바꿉니다. 기본값 <b>생성 / 미캔</b>은 이름 변경·순서 변경만 가능합니다.
            </p>
            <StatusColumnsSettings
              planId={plan.id}
              columns={snapshot.statusColumns}
            />
          </>
        )}

        {tab === 'storage' && (
          <div className="storage-settings">
            <section className="gs-block">
              <h4>저장 위치</h4>
              <p className="hint">
                작업 내용은 <b>이 기기의 브라우저(IndexedDB)</b>에 자동
                저장됩니다. 회원가입·로그인 없음. 다른 기기와 자동 동기화되지
                않으니, 브라우저 데이터를 삭제하거나 다른 기기·브라우저에서
                접속하면 저장된 작업이 자동으로 나타나지 않을 수 있습니다. 중요한
                작업은 아래 Excel로 백업하세요.
              </p>
            </section>

            <section className="gs-block">
              <h4>Excel 백업</h4>
              <div className="storage-actions">
                <div className="storage-action">
                  <button className="btn btn-primary" onClick={onFullExport} aria-describedby="backup-export-help">
                    Excel 전체 백업
                  </button>
                  <p id="backup-export-help">현재 계획의 모든 키워드와 체크 상태를 Excel로 저장합니다. 지난 날짜도 포함됩니다.</p>
                </div>
                <div className="storage-action">
                  <button className="btn" onClick={onOpenImport} aria-describedby="backup-import-help">
                    Excel 가져오기 (복원)
                  </button>
                  <p id="backup-import-help">Excel 파일을 현재 계획으로 불러옵니다. 같은 날짜·키워드는 파일의 체크 상태로 덮어씁니다.</p>
                </div>
                <div className="storage-action">
                  <button className="btn" onClick={onDownloadTemplate} aria-describedby="backup-template-help">
                    템플릿 내려받기
                  </button>
                  <p id="backup-template-help">키워드를 직접 작성할 Excel 양식을 받습니다. 작성한 파일은 ‘Excel 가져오기’로 등록하세요.</p>
                </div>
              </div>
            </section>

            {directGenerationEnabled && (
              <section className="gs-block">
                <h4>보안</h4>
                <p className="hint">
                  Direct Generate용 개인 API Key는 <b>이 기기에만</b> 저장되며 Excel
                  백업이나 향후 계정 동기화에 포함되지 않습니다. 다른 기기에서
                  Direct Generate를 쓰려면 그 기기에서 API Key를 다시 등록해야
                  합니다. (일반 생성 사이트 URL은 비밀값이 아니므로 향후 동기화 대상이 될
                  수 있습니다.)
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
