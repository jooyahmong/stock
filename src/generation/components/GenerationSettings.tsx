import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import {
  useDirectGenerationService,
  useGenerationConfig,
  useGenerationStore,
} from '../GenerationContext'
import { PROVIDER_TYPES } from '../providers'
import type { ProviderType } from '../types'

/** 기본 생성 방식 라디오만. 아래 상세 설정은 SettingsModal이 선택에 따라 바꾼다. */
export function GenerationModeChooser() {
  const cfg = useGenerationConfig()
  const store = useGenerationStore()
  return (
    <section className="gs-block">
      <h4>기본 생성 방식</h4>
      <label className="gs-radio">
        <input
          type="radio"
          name="gen-mode"
          checked={cfg.defaultGenerationMode === 'direct'}
          onChange={() => store.setDefaultMode('direct')}
        />
        <span>
          <b>Direct Generate</b> — WOOJOO Stock Planner 안에서 바로 생성{' '}
          <span className="hint">(API 연결 필요)</span>
        </span>
      </label>
      <label className="gs-radio">
        <input
          type="radio"
          name="gen-mode"
          checked={cfg.defaultGenerationMode === 'my-gpt'}
          onChange={() => store.setDefaultMode('my-gpt')}
        />
        <span>
          <b>내 생성 사이트</b> — 복사 후 사이트에서 생성{' '}
          <span className="hint">(API 불필요)</span>
        </span>
      </label>
    </section>
  )
}

/**
 * Direct Generate 상세 설정 (개인 이미지 생성 API 등록).
 * My GPT 설정은 SettingsModal의 <GeneratorsSettings/>가 담당한다 (독립 저장).
 */
export function DirectGenerateSettings() {
  const cfg = useGenerationConfig()
  const store = useGenerationStore()
  const service = useDirectGenerationService()
  const showToast = useUiStore((s) => s.showToast)

  const existing = cfg.providers[0] ?? null

  const [providerType, setProviderType] = useState<ProviderType>(
    existing?.providerType ?? 'openai',
  )
  const [name, setName] = useState(existing?.name ?? 'My API')
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '')
  const [model, setModel] = useState(existing?.model ?? 'gpt-image-1')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')

  const models = useMemo(
    () => PROVIDER_TYPES.find((p) => p.type === providerType)?.models ?? [],
    [providerType],
  )

  const buildRecord = () => ({
    id: existing?.id ?? 'draft',
    name: name.trim() || 'My API',
    providerType,
    apiKey,
    model: model.trim(),
    isDefault: true,
    enabled: existing?.enabled ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const runTest = async () => {
    if (!apiKey.trim()) {
      setTestResult('API Key를 입력하세요.')
      return
    }
    setTesting(true)
    setTestResult('')
    try {
      const res = await service.testConnection(buildRecord())
      setTestResult((res.ok ? '✓ ' : '✗ ') + res.message)
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    store.saveProvider({ id: existing?.id, name, providerType, apiKey, model })
    showToast('Direct Generate 설정을 저장했습니다.')
  }

  return (
    <section className="gs-block">
      <h4>Direct Generate</h4>
      <p className="hint">
        개인 이미지 생성 API를 등록합니다. 키는 이 브라우저(localStorage)에만
        저장되며 앱 저장소와 분리되어 있습니다. 운영 배포 시 저장 방식은 재검토가
        필요합니다.
      </p>

      <label className="field-label">API Provider</label>
      <select
        className="field-input"
        value={providerType}
        onChange={(e) => {
          const next = e.target.value as ProviderType
          setProviderType(next)
          const first = PROVIDER_TYPES.find((p) => p.type === next)?.models[0]
          if (first) setModel(first)
        }}
      >
        {PROVIDER_TYPES.map((p) => (
          <option key={p.type} value={p.type}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="field-label">이름</label>
      <input
        className="field-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="field-label">API Key</label>
      <input
        className="field-input"
        type="password"
        autoComplete="off"
        placeholder="sk-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <label className="field-label">Model</label>
      <select
        className="field-input"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      >
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        {!models.includes(model) && model && <option value={model}>{model}</option>}
      </select>

      <div className="gs-actions">
        <button className="btn btn-sm" onClick={runTest} disabled={testing}>
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button className="btn btn-sm btn-primary" onClick={save}>
          Save
        </button>
        {existing && (
          <button
            className="btn btn-sm btn-danger-ghost"
            onClick={() => {
              store.removeProvider(existing.id)
              setApiKey('')
              showToast('Direct Generate 설정을 삭제했습니다.')
            }}
          >
            삭제
          </button>
        )}
      </div>
      {testResult && <p className="gs-test-result">{testResult}</p>}

      {existing && (
        <label className="gs-radio" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={existing.enabled}
            onChange={(e) => store.setEnabled(existing.id, e.target.checked)}
          />
          <span>이 Provider 사용 (enabled)</span>
        </label>
      )}
    </section>
  )
}
