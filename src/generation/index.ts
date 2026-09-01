/**
 * Public surface of the OPTIONAL Direct Generate layer.
 *
 * The rest of the app touches Direct Generate through this barrel only, and
 * always behind `directGenerationEnabled`. To remove the feature entirely:
 *   1. delete `src/generation/`
 *   2. remove the <GenerationProvider> wrapper in `src/main.tsx`
 *   3. remove the 3 guarded `directGenerationEnabled` branches in `src/App.tsx`
 *      and `src/components/settings/SettingsModal.tsx`
 * WOOJOO Stock Planner + My GPT keep working.
 */
export { directGenerationEnabled } from './featureFlags'
export { GenerationProvider, useGenerationConfig } from './GenerationContext'
export { GenerateModal } from './components/GenerateModal'
export {
  GenerationModeChooser,
  DirectGenerateSettings,
} from './components/GenerationSettings'
