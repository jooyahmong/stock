import { useState } from 'react'
import type { Generator } from '../../repo/types'
import { useRepository } from '../../repo/RepositoryContext'
import { useRepoQuery } from '../../repo/RepositoryContext'
import { useUiStore } from '../../store/uiStore'
import { isAllowedGptUrl, GPT_URL_HINT } from '../../lib/gptUrl'

/**
 * Generator = a saved GPT / GPTs link (principle 20). Multiple are supported;
 * one is the default used when a keyword is clicked. The app never claims to
 * auto-send a prompt — it copies text and opens this URL in a new tab.
 */
export function GeneratorsSettings() {
  const repo = useRepository()
  const showToast = useUiStore((s) => s.showToast)
  const { data: generators } = useRepoQuery((r) => r.listGenerators(), [])

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const urlValid = url.trim().length === 0 || isAllowedGptUrl(url)

  const add = async () => {
    if (!name.trim() || !url.trim()) return
    if (!isAllowedGptUrl(url)) {
      showToast(GPT_URL_HINT, 'error')
      return
    }
    await repo.createGenerator({ name, url: url.trim() })
    setName('')
    setUrl('')
    showToast('My GPT를 추가했습니다.')
  }

  const list = generators ?? []

  return (
    <div className="gen-settings">
      {list.length === 0 && (
        <p className="hint">
          아직 저장된 Generator가 없습니다. 사용하는 GPT / GPTs 링크를 추가하세요.
        </p>
      )}

      <ul className="gen-list">
        {list.map((g) => (
          <GeneratorRow key={g.id} generator={g} />
        ))}
      </ul>

      <div className="gen-add">
        <div className="gen-add-title">새 Generator</div>
        <label className="field-label">Generator Name</label>
        <input
          className="field-input"
          value={name}
          placeholder="예: My Stock Image GPT"
          onChange={(e) => setName(e.target.value)}
        />
        <label className="field-label">GPT / GPTs URL</label>
        <input
          className="field-input"
          value={url}
          placeholder="https://chatgpt.com/g/..."
          onChange={(e) => setUrl(e.target.value)}
        />
        {!urlValid && <p className="hint hint-error">{GPT_URL_HINT}</p>}
        <button
          className="btn btn-primary btn-sm"
          onClick={add}
          disabled={!name.trim() || !url.trim() || !isAllowedGptUrl(url)}
        >
          추가
        </button>
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
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="field-input"
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
