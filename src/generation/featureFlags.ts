/**
 * Master switch for the Direct Generate layer.
 *
 * Default ON for local V1. Turn it off with a `.env` entry:
 *   VITE_DIRECT_GENERATION=false
 *
 * When false: no Direct Generate UI is rendered, the keyword click always uses
 * My GPT, and nothing in `src/generation/` runs. The folder can then be deleted
 * (see README) without touching the rest of the app.
 */
const raw = import.meta.env.VITE_DIRECT_GENERATION as string | boolean | undefined

export const directGenerationEnabled: boolean =
  raw === undefined ? true : String(raw).toLowerCase() !== 'false'
