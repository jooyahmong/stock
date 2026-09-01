import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development only. Do NOT add deploy / Cloudflare config here without an explicit request.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
})
