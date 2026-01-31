import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/stocks': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/analyze': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/config': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
