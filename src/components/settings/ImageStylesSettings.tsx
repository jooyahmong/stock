import { useState } from 'react'
import { useImageStyles } from '../../hooks/useImageStyles'
import { useRepository } from '../../repo/RepositoryContext'
import { useUiStore } from '../../store/uiStore'
import { IMAGE_STYLES_KEY } from '../../lib/settingsKeys'
import { removeImageStyle, type ImageStyle, type ImageStyleSettings } from '../../domain/imageStyles'

export function ImageStylesSettings() {
  const repo = useRepository()
  const { data: settings, error } = useImageStyles()
  const showToast = useUiStore((s) => s.showToast)
  const [pending, setPending] = useState(false)
  const [adding, setAdding] = useState(false)

  async function persist(next: ImageStyleSettings, message: string) {
    setPending(true)
    try {
      await repo.setSetting(IMAGE_STYLES_KEY, next)
      setAdding(false)
      showToast(message)
    } catch {
      showToast('스타일을 저장하지 못했습니다. 다시 시도해주세요.', 'error')
    } finally {
      setPending(false)
    }
  }

  if (error) return <p role="alert">그림 스타일을 불러오지 못했습니다. 설정을 다시 열어주세요.</p>
  if (!settings) return <p className="hint">그림 스타일을 불러오는 중…</p>
  const selected = settings.styles.find((style) => style.id === settings.selectedId)

  return (
    <section className="gs-block image-styles" aria-label="그림 스타일 설정">
      <p className="hint">
        키워드 뒤에 선택한 스타일의 지시문을 붙여 복사합니다. 열린 생성 사이트에
        붙여넣고 전송하세요. 스타일 이름과 지시문을 자유롭게 수정할 수 있습니다.
      </p>
      <fieldset className="style-controls" disabled={pending}>
        <div className="style-field-row">
          <label className="field-label" htmlFor="image-style-select">사용할 그림 스타일</label>
          <select id="image-style-select" className="field-input" value={settings.selectedId ?? ''}
            onChange={(e) => void persist({ ...settings, selectedId: e.target.value || null }, '그림 스타일을 선택했습니다.')}>
            {settings.styles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
            <option value="">스타일 없이 키워드만 복사</option>
          </select>
        </div>
        {!adding && selected && (
          <StyleEditor key={`${selected.id}:${selected.name}:${selected.prompt}`} style={selected}
            onSave={(name, prompt) => persist({ ...settings, styles: settings.styles.map((style) => style.id === selected.id ? { ...style, name, prompt } : style) }, '그림 스타일을 저장했습니다.')}
            onDelete={() => void persist(removeImageStyle(settings, selected.id), '그림 스타일을 삭제했습니다.')} />
        )}
        {!adding && !selected && <p className="hint">키워드만 복사합니다. 스타일을 선택하거나 추가하면 그림 지시문을 함께 복사합니다.</p>}
        {adding ? (
          <StyleEditor key="new" onCancel={() => setAdding(false)} onSave={(name, prompt) => {
            const style = { id: crypto.randomUUID(), name, prompt }
            return persist({ ...settings, styles: [...settings.styles, style], selectedId: style.id }, '그림 스타일을 추가하고 선택했습니다.')
          }} />
        ) : (
          <button className="btn btn-sm" onClick={() => setAdding(true)}>+ 스타일 추가</button>
        )}
      </fieldset>
      <p className="hint">스타일 설정은 이 브라우저에 저장되며 Excel 백업에는 포함되지 않습니다.</p>
    </section>
  )
}

function StyleEditor({ style, onSave, onDelete, onCancel }: {
  style?: ImageStyle
  onSave: (name: string, prompt: string) => Promise<void>
  onDelete?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(style?.name ?? '')
  const [prompt, setPrompt] = useState(style?.prompt ?? '')
  const dirty = name !== (style?.name ?? '') || prompt !== (style?.prompt ?? '')
  return (
    <div className="style-editor">
      <div className="style-field-row">
        <label className="field-label" htmlFor="image-style-name">스타일 이름</label>
        <input id="image-style-name" className="field-input" value={name} placeholder="예: 따뜻한 파스텔 일러스트"
          onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="style-field-row">
        <label className="field-label" htmlFor="image-style-prompt">스타일 지시문</label>
        <textarea id="image-style-prompt" className="field-input" rows={4} value={prompt}
          placeholder="예: 2D 플랫 일러스트 스타일의 그림을 그려줘. 흰 배경으로 실제 이미지를 생성해줘."
          onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <p className="hint">클릭한 주제 키워드는 앞에 자동으로 붙습니다. 수정한 내용은 ‘스타일 저장’을 눌러 적용하세요.</p>
      <div className="gs-actions">
        <button className="btn btn-primary btn-sm" disabled={!name.trim() || !prompt.trim() || !dirty}
          onClick={() => void onSave(name.trim(), prompt.trim())}>{style ? '스타일 저장' : '스타일 추가하고 선택'}</button>
        {onDelete && <button className="btn btn-danger-ghost btn-sm" onClick={onDelete}>이 스타일 삭제</button>}
        {onCancel && <button className="btn btn-sm" onClick={onCancel}>취소</button>}
      </div>
    </div>
  )
}
