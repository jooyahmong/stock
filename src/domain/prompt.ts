/**
 * Text handed to the external generator when a keyword is clicked.
 *
 * Style instructions follow the keyword. Existing templates may place the
 * keyword explicitly with {{keyword}}. No instruction means keyword only.
 */
export function buildGeneratorText(keyword: string, template?: string | null): string {
  const kw = keyword.trim()
  if (!kw) return ''
  const instruction = template?.trim()
  if (!instruction) return kw
  if (instruction.includes('{{keyword}}')) {
    return instruction.split('{{keyword}}').join(kw)
  }
  return `${kw} ${instruction}`
}
