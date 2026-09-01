/**
 * My GPT link validation.
 *
 * User-entered URLs are NOT trusted to be ChatGPT just because they were typed.
 * A My GPT URL is accepted only when it is:
 *   - the https: protocol (blocks javascript:, data:, http:, blob:, …)
 *   - hosted on chatgpt.com (or www.chatgpt.com)
 * Anything else — arbitrary external hosts, look-alike domains — is rejected.
 */
const ALLOWED_HOSTS = new Set(['chatgpt.com', 'www.chatgpt.com'])

export function isAllowedGptUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(String(raw).trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  return ALLOWED_HOSTS.has(url.hostname.toLowerCase())
}

export const GPT_URL_HINT = 'https 프로토콜의 chatgpt.com 링크만 허용됩니다.'
