/** Copy text with a legacy fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export type OpenResult = 'opened' | 'popup-blocked'

/**
 * Open the My GPT URL in a NEW tab, every time.
 *
 * (Reliable reuse of an existing ChatGPT tab isn't possible — it sends
 * `Cross-Origin-Opener-Policy: same-origin`, which severs the opener link on
 * load. Since only a handful of keyword clicks happen per day, a fresh tab per
 * click is fine for now; this can be revisited later.)
 *
 * `url` must already be validated (see lib/gptUrl.ts).
 */
export function openGptWindow(url: string): OpenResult {
  const win = window.open(url, '_blank')
  if (!win) return 'popup-blocked'
  try {
    win.focus()
  } catch {
    /* navigation to the tab already succeeded */
  }
  return 'opened'
}
