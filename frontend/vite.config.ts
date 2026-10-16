import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Dev server mirrors the production nginx proxy: /api/* -> n8n /webhook/*,
// with the API key added server-side so it never reaches the browser bundle.
export default defineConfig(({ mode }) => {
  // KMS_API_KEY is read from the n8n stack's .env (single source), never copied here.
  const envDir = process.env.KMS_ENV_DIR || path.resolve(__dirname, '../../n8n')
  const env = { ...loadEnv(mode, envDir, 'KMS_'), ...loadEnv(mode, process.cwd(), 'KMS_') }
  const target = env.KMS_N8N_URL || 'https://n8n.cencendi.my.id'
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      host: true,
      allowedHosts: true,
      // dummy-emails/ lives one level above the app and is bundled as scenario samples.
      fs: { allow: ['..'] },
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, '/webhook'),
          headers: { 'X-KMS-API-KEY': env.KMS_API_KEY ?? '' },
        },
      },
    },
  }
})
