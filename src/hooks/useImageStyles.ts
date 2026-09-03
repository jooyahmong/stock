import { useRepoQuery } from '../repo/RepositoryContext'
import { IMAGE_STYLES_KEY, PROMPT_TEMPLATE_KEY } from '../lib/settingsKeys'
import { resolveImageStyles, type ImageStyleSettings } from '../domain/imageStyles'

export function useImageStyles() {
  return useRepoQuery(async (repo) => {
    const [saved, legacyTemplate] = await Promise.all([
      repo.getSetting<ImageStyleSettings>(IMAGE_STYLES_KEY),
      repo.getSetting<string>(PROMPT_TEMPLATE_KEY),
    ])
    return resolveImageStyles(saved, legacyTemplate)
  }, [])
}
