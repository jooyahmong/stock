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
 * Open the selected generation website in a new tab. Detach the opener before
 * navigating so an external site cannot navigate the planner through it.
 *
 * `url` must already be validated (see lib/gptUrl.ts).
 */
export function openGptWindow(url: string): OpenResult {
  const win = window.open('about:blank', '_blank')
  if (!win) return 'popup-blocked'
  try {
    win.opener = null
    win.location.replace(url)
  } catch {
    win.close()
    return 'popup-blocked'
  }
  try {
    win.focus()
  } catch {
    /* navigation to the tab already succeeded */
  }
  return 'opened'
}
