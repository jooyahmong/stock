import { useState } from 'react'
import type { Plan, PlanSnapshot } from '../../repo/types'
import { Modal } from '../Modal'
import { GeneratorsSettings } from './GeneratorsSettings'
import { StatusColumnsSettings } from './StatusColumnsSettings'
import {
  directGenerationEnabled,
  useGenerationConfig,
  GenerationModeChooser,
  DirectGenerateSettings,
} from '../../generation'

type Tab = 'generator' | 'stages' | 'excel'

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
          className={tab === 'excel' ? 'is-active' : ''}
          onClick={() => setTab('excel')}
        >
          엑셀 (Excel)
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
                <h4>My GPT</h4>
                <p className="hint">
                  내 GPT/GPTs 링크입니다. 키워드 클릭 시 프롬프트를 복사하고 이 링크를
                  기존 GPT 탭으로 엽니다. 자동 전송은 하지 않습니다.
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

        {tab === 'excel' && (
          <div className="excel-settings">
            <p className="hint">
              한 행 = 한 키워드. 같은 날짜가 반복되어도 정상이며 날짜 셀은 병합하지
              않습니다.
            </p>
            <button className="btn" onClick={onDownloadTemplate}>
              템플릿 내려받기 (Template)
            </button>
            <button className="btn" onClick={onOpenImport}>
              엑셀 내역 가져오기 (Import)
            </button>
            <button className="btn" onClick={onFullExport}>
              엑셀로 내보내기 (Full Export · 작업 상태 포함)
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
