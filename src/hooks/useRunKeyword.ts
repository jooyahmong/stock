import { useCallback } from 'react'
import { useRepoQuery } from '../repo/RepositoryContext'
import { useUiStore } from '../store/uiStore'
import { buildGeneratorText } from '../domain/prompt'
import { copyText, openGptWindow } from '../lib/clipboard'
import { isAllowedGptUrl } from '../lib/gptUrl'
import { PROMPT_TEMPLATE_KEY } from '../lib/settingsKeys'

/**
 * Keyword-text click behaviour for a saved generation site:
 *   1. build the prompt text (raw keyword in V1)
 *   2. copy to clipboard
 *   3. open the configured URL in a new tab (every click — see clipboard.ts)
 * The click never auto-checks "생성" — the user does that after real work.
 */
export function useRunKeyword() {
  const showToast = useUiStore((s) => s.showToast)
  const { data: generators } = useRepoQuery((r) => r.listGenerators(), [])
  const { data: template } = useRepoQuery(
    (r) => r.getSetting<string>(PROMPT_TEMPLATE_KEY),
    [],
  )

  return useCallback(
    async (keyword: string, onNeedSettings?: () => void) => {
      const text = buildGeneratorText(keyword, template)
      const copying = copyText(text)

      const def =
        generators?.find((g) => g.isDefault) ?? generators?.[0] ?? null

      if (!def || !def.url) {
        const copied = await copying
        showToast(
          copied
            ? '키워드를 복사했습니다. 설정 > 생성에서 생성 사이트 주소를 먼저 저장하세요.'
            : '설정 > 생성에서 생성 사이트 주소를 먼저 저장하세요.',
          'error',
        )
        onNeedSettings?.()
        return
      }

      if (!isAllowedGptUrl(def.url)) {
        await copying
        showToast(
          '등록된 생성 사이트 주소가 올바르지 않습니다. HTTPS 주소를 다시 저장하세요.',
          'error',
        )
        onNeedSettings?.()
        return
      }

      // Open during the original click, before awaiting clipboard permissions.
      const result = openGptWindow(def.url)
      const copied = await copying
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
    [generators, template, showToast],
  )
}
