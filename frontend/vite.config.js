import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-signature-canvas')) return 'signature-vendor';
          if (id.includes('lucide-react')) return 'ui-vendor';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/')
          ) {
            return 'react-vendor';
          }
          return 'vendor';
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'https://my-backend-kafl.onrender.com',
        changeOrigin: true
      }
    }
  }
})
