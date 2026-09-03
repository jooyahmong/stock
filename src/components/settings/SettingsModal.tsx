import { useState } from 'react'
import type { Plan, PlanSnapshot } from '../../repo/types'
import { Modal } from '../Modal'
import { periodKind, periodColumnLabel } from '../../domain/periods'
import { GeneratorsSettings } from './GeneratorsSettings'
import { StatusColumnsSettings } from './StatusColumnsSettings'
import {
  directGenerationEnabled,
  useGenerationConfig,
  GenerationModeChooser,
  DirectGenerateSettings,
} from '../../generation'

type Tab = 'generator' | 'stages' | 'storage'

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
  const genCfg = useGenerationConfig()
  const mode = directGenerationEnabled ? genCfg.defaultGenerationMode : 'my-gpt'

  return (
    <Modal title="설정" onClose={onClose} width={640}>
      <div className="settings-tabs">
        <button
          className={tab === 'generator' ? 'is-active' : ''}
          onClick={() => setTab('generator')}
        >
          생성
        </button>
        <button
          className={tab === 'stages' ? 'is-active' : ''}
          onClick={() => setTab('stages')}
        >
          체크 항목
        </button>
        <button
          className={tab === 'storage' ? 'is-active' : ''}
          onClick={() => setTab('storage')}
        >
          저장 · 백업
        </button>
      </div>

      <div className="settings-panel">
        {tab === 'generator' && (
          <>
            {directGenerationEnabled && <GenerationModeChooser />}

            {/* 선택한 방식의 설정만 아래에 표시 */}
            {directGenerationEnabled && mode === 'direct' && <DirectGenerateSettings />}

            {mode === 'my-gpt' && (
              <section className="gs-block">
                <h4>내 생성 사이트</h4>
                <p className="hint">
                  ChatGPT·Gemini·Midjourney 등 사용하는 사이트를 등록하세요. 키워드를
                  클릭하면 프롬프트를 복사하고 기본 사이트를 새 탭으로 엽니다.
                  열린 사이트의 입력창에 직접 붙여넣으세요.
                </p>
                <GeneratorsSettings />
              </section>
            )}
          </>
        )}

        {tab === 'stages' && (
          <>
            <p className="hint">
              계획 <b>{plan.name}</b>의 체크 항목입니다. 왼쪽 체크로 목록 표시 여부를
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
                <button className="btn btn-primary" onClick={onFullExport}>
                  Excel 전체 백업
                </button>
                <button className="btn" onClick={onOpenImport}>
                  Excel 가져오기 (복원)
                </button>
                <button className="btn" onClick={onDownloadTemplate}>
                  템플릿 내려받기
                </button>
              </div>
              <p className="hint">
                파일 열은 <b>{periodColumnLabel(periodKind(plan.type))} · Keyword ·
                생성 · 미캔 · 사용자 정의 체크 항목</b>으로 템플릿·백업이 같은
                구조입니다. 같은 날짜는 병합 없이 각 행에 반복되며, 가져오기 시
                같은 날짜+Keyword는 기존 항목의 체크값을 그대로 덮어씁니다(중복
                생성 안 함).
              </p>
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
