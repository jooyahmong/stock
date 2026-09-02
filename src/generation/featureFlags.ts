/**
 * Master switch for the Direct Generate layer.
 *
 * Default OFF: personal image-generation APIs (OpenAI, Gemini/Imagen) all require
 * paid billing, so the feature is hidden for now. Turn it back on with a `.env`
 * entry (or a Cloudflare Pages env var):
 *   VITE_DIRECT_GENERATION=true
 *
 * When off: no Direct Generate UI is rendered, the keyword click always uses
 * My GPT, and nothing in `src/generation/` runs. The folder can be deleted
 * entirely (see README) without touching the rest of the app.
 */
const raw = import.meta.env.VITE_DIRECT_GENERATION as string | boolean | undefined

export const directGenerationEnabled: boolean =
  String(raw).toLowerCase() === 'true'

// Exposed for the e2e harness to detect which UI to expect.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__DIRECT_GENERATION__ =
    directGenerationEnabled
}
