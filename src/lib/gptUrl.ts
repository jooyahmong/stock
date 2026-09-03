/**
 * Validate a user-selected generation website. The historical export name is
 * retained for existing callers; links may point to any HTTPS website.
 * Embedded credentials and executable/non-HTTPS protocols are never accepted.
 */

export function isAllowedGptUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(String(raw).trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  return Boolean(url.hostname) && !url.username && !url.password
}

export const GPT_URL_HINT = 'https://로 시작하는 생성 사이트 주소를 입력하세요. 아이디·비밀번호가 포함된 주소는 사용할 수 없습니다.'
