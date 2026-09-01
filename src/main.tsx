import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { RepositoryProvider } from './repo/RepositoryContext'
import { DexieRepository } from './repo/dexie/DexieRepository'
import { runSeedOnce, __wipeAllData } from './repo/dexie/seed'
// Optional Direct Generate layer — see src/generation/index.ts for removal steps.
import { GenerationProvider } from './generation'

// V1 storage backend. Swapping this line for a future `D1Repository` is the
// entire migration on the app side.
const repository = new DexieRepository()

void runSeedOnce(repository)

if (import.meta.env.DEV) {
  // Dev helper for manual testing (see test scenarios in README).
  ;(window as unknown as Record<string, unknown>).__wipeAllData = __wipeAllData
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RepositoryProvider repository={repository}>
      <GenerationProvider>
        <App />
      </GenerationProvider>
    </RepositoryProvider>
  </React.StrictMode>,
)
