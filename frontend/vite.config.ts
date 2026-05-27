import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
const apiProxy = {
  // Same-origin `/api` → Go API (default PORT=9001 in api/.env).
  '/api': {
    target: 'http://127.0.0.1:9001',
    changeOrigin: true,
    timeout: 180000,
  },
} as const

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: { ...apiProxy },
  },
  // `vite preview` does not inherit `server.proxy` — without this, POST /api/* hits the static
  // preview server and returns 405 Method Not Allowed.
  preview: {
    proxy: { ...apiProxy },
  },
})
