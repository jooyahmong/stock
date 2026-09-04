import { useCallback } from 'react'
import { useRepoQuery } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { buildGeneratorText } from '../domain/prompt'
import { copyText, openGptWindow } from '../lib/clipboard'
import { isAllowedGptUrl } from '../lib/gptUrl'
import { useImageStyles } from './useImageStyles'

/**
 * Keyword-text click behaviour for a saved generation site:
 *   1. combine the keyword with the selected style instructions
 *   2. copy to clipboard
 *   3. open the configured URL in a new tab (every click — see clipboard.ts)
 * The click never auto-checks "생성" — the user does that after real work.
 */
export function useRunKeyword() {
  const showToast = useUiStore((s) => s.showToast)
  const { data: generators } = useRepoQuery((r) => r.listGenerators(), [])
  const { data: styles, error: styleError } = useImageStyles()

  return useCallback(
    async (keyword: string, onNeedSettings?: () => void) => {
      if (!styles || styleError) {
        showToast('그림 스타일을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.', 'error')
        return
      }
      const style = styles.styles.find((s) => s.id === styles.selectedId)
      const text = buildGeneratorText(keyword, style?.prompt)
      // Finish copying while the planner still has focus. Opening a new tab
      // first can make the browser reject a pending clipboard write.
      const copied = await copyText(text)

      const def = generators?.find((g) => g.isDefault) ?? null

      if (!def || !def.url) {
        showToast(
          copied
            ? '프롬프트를 복사했습니다. 설정 > 생성에서 기본 생성 사이트를 선택하세요.'
            : '설정 > 생성에서 기본 생성 사이트를 선택하세요.',
          'error',
        )
        onNeedSettings?.()
        return
      }

      if (!isAllowedGptUrl(def.url)) {
        showToast(
          '등록된 생성 사이트 주소가 올바르지 않습니다. HTTPS 주소를 다시 저장하세요.',
          'error',
        )
        onNeedSettings?.()
        return
      }

      const result = openGptWindow(def.url)
      if (result === 'popup-blocked') {
        showToast(
          `${copied ? '복사됨. ' : ''}팝업이 차단되었습니다. 팝업을 허용해주세요.`,
          'error',
        )
        return
      }
      showToast(
        copied
          ? `프롬프트 복사됨 · ${def.name} 탭의 입력창에 붙여넣으세요.`
          : `${def.name} 탭 열림 (복사 실패)`,
      )
    },
    [generators, styles, styleError, showToast],
  )
}
