/**
 * Text handed to the external generator when a keyword is clicked.
 *
 * V1: the raw keyword. The optional template hook is here so a future
 * "Prompt Template" setting (Phase 2) plugs in without touching callers.
 */
export function buildGeneratorText(keyword: string, template?: string | null): string {
  const kw = keyword.trim()
  if (template && template.includes('{{keyword}}')) {
    return template.split('{{keyword}}').join(kw)
  }
  return kw
}
