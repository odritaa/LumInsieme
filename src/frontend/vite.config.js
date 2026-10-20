import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const reunionTarget = process.env.VITE_REUNION_TARGET || 'http://localhost:4100'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: process.env.VITE_LOGIN_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/cartelera': { target: reunionTarget, changeOrigin: true },
      '/salas': { target: reunionTarget, changeOrigin: true },
      '/ws': {
        target: process.env.VITE_CHAT_TARGET || 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
