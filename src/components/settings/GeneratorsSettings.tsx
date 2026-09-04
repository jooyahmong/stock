import { useEffect, useRef, useState } from 'react'
import type { Generator } from '../../repo/types'
import { useRepository } from '../../repo/RepositoryContext'
import { useRepoQuery } from '../../repo/RepositoryContext'
import { useUiStore } from '../../store/uiStore'
import { isAllowedGptUrl, GPT_URL_HINT } from '../../lib/gptUrl'

const DEFAULT_GENERATORS = [
  { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { key: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { key: 'midjourney', name: 'Midjourney', url: 'https://www.midjourney.com/imagine' },
] as const

function defaultGeneratorKey(url: string): typeof DEFAULT_GENERATORS[number]['key'] | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.replace(/\/+$/, '') || '/'
    if ((host === 'chatgpt.com' || host === 'chat.openai.com') && path === '/') return 'chatgpt'
    if (host === 'gemini.google.com' && path === '/app') return 'gemini'
    if ((host === 'midjourney.com' || host === 'www.midjourney.com') && path === '/imagine') return 'midjourney'
  } catch {
    return null
  }
  return null
}

/**
 * Generator = a saved generation website link. Multiple are supported;
 * one is the default used when a keyword is clicked. The app never claims to
 * auto-send a prompt — it copies text and opens this URL in a new tab.
 */
export function GeneratorsSettings() {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const { data: generators } = useRepoQuery((r) => r.listGenerators(), [])

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const initializedDefaults = useRef(false)

  useEffect(() => {
    if (!generators || initializedDefaults.current) return
    initializedDefaults.current = true
    void (async () => {
      const existingKeys = new Set(generators.map((generator) => defaultGeneratorKey(generator.url)))
      for (const preset of DEFAULT_GENERATORS) {
        if (existingKeys.has(preset.key)) continue
        await repo.createGenerator({
          name: preset.name,
          url: preset.url,
          isDefault: false,
        })
      }
    })()
  }, [generators, repo])

  const urlValid = url.trim().length === 0 || isAllowedGptUrl(url)

  const add = async () => {
    if (!name.trim() || !url.trim()) return
    if (!isAllowedGptUrl(url)) {
      showToast(GPT_URL_HINT, 'error')
      return
    }
    await repo.createGenerator({ name, url: url.trim(), isDefault: false })
    setName('')
    setUrl('')
    showToast('생성 사이트를 추가했습니다.')
  }

  const list = generators ?? []
  const presetRows = DEFAULT_GENERATORS.map((preset) => ({
    preset,
    generator: list.find((generator) => defaultGeneratorKey(generator.url) === preset.key),
  }))
  const customGenerators = list.filter((generator) => defaultGeneratorKey(generator.url) === null)

  return (
    <div className="gen-settings">
      <div className="gen-section-title">기본 생성 사이트 선택</div>
      <p className="hint gen-section-hint">키워드를 클릭할 때 열 사이트를 선택하세요. 각 사이트에는 본인 계정으로 로그인해야 합니다.</p>
      <div className="gen-presets" role="radiogroup" aria-label="기본 생성 사이트">
        {presetRows.map(({ preset, generator }) => (
          <label key={preset.key} className="gen-preset">
            <input type="radio" name="default-generator" checked={generator?.isDefault ?? false}
              onChange={() => {
                if (generator) void repo.updateGenerator(generator.id, { isDefault: true })
                else void repo.createGenerator({ name: preset.name, url: preset.url, isDefault: true })
              }} />
            <strong>{preset.name}</strong>
          </label>
        ))}
      </div>

      <ul className="gen-list">
        {customGenerators.map((g) => (
          <GeneratorRow key={g.id} generator={g} />
        ))}
      </ul>

      <div className="gen-add">
        <div className="gen-add-header">
          <div className="gen-add-title">다른 생성 사이트 추가</div>
          <p className="hint">개인 GPTs 등 원하는 생성 사이트의 HTTPS 주소를 등록하세요.</p>
        </div>
        <div className="gen-add-fields">
          <label className="field-label" htmlFor="generator-name">사이트 이름</label>
          <input
            id="generator-name"
            className="field-input"
            value={name}
            placeholder="예: 내 이미지 GPT, Adobe Firefly"
            onChange={(e) => setName(e.target.value)}
          />
          <label className="field-label" htmlFor="generator-url">사이트 주소</label>
          <input
            id="generator-url"
            className="field-input"
            value={url}
            placeholder="https://gemini.google.com/app"
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="btn btn-primary gen-add-submit"
            onClick={add}
            disabled={!name.trim() || !url.trim() || !isAllowedGptUrl(url)}
          >
            추가
          </button>
        </div>
        {!urlValid && <p className="hint hint-error">{GPT_URL_HINT}</p>}
      </div>
    </div>
  )
}

function GeneratorRow({ generator }: { generator: Generator }) {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const [name, setName] = useState(generator.name)
  const [url, setUrl] = useState(generator.url)

  const dirty = name !== generator.name || url !== generator.url
  const urlValid = isAllowedGptUrl(url)

  const save = () => {
    if (!urlValid) {
      showToast(GPT_URL_HINT, 'error')
      return
    }
    repo.updateGenerator(generator.id, { name, url: url.trim() })
  }

  return (
    <li className="gen-row">
      <label className="gen-default">
        <input
          type="radio"
          name="default-generator"
          checked={generator.isDefault}
          onChange={() => repo.updateGenerator(generator.id, { isDefault: true })}
        />
        기본
      </label>
      <div className="gen-fields">
        <input
          className="field-input"
          aria-label="생성 사이트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field-input"
          aria-label="생성 사이트 주소"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="gen-row-actions">
        <button
          className="btn btn-xs btn-primary"
          disabled={!dirty || !name.trim() || !urlValid}
          onClick={save}
        >
          저장
        </button>
        <button
          className="btn btn-xs btn-danger-ghost"
          onClick={() => repo.deleteGenerator(generator.id)}
        >
          삭제
        </button>
      </div>
    </li>
  )
}
