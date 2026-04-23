import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Studio mode: alias dexie-react-hooks → shim, który refresh'uje useLiveQuery
  // na zmiany z storage-adapter (HTTP API zamiast IndexedDB).
  resolve: mode === 'studio' ? {
    alias: {
      'dexie-react-hooks': path.resolve(__dirname, 'src/studio/dexie-react-hooks-shim.js'),
    },
  } : {},
}))
