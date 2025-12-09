import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Utilities
          'vendor-utils': ['jszip', 'jose', 'spark-md5', 'react-dropzone'],
        },
      },
    },
  },
})
