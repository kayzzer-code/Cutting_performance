import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/open-food-facts': {
        target: 'https://world.openfoodfacts.org',
        changeOrigin: true,
        headers: {
          'User-Agent': 'CUTPerformance/1.0 (https://github.com/kayzzer-code/Cutting_performance)',
        },
        rewrite: (path) => path.replace(/^\/api\/open-food-facts/, '/api/v3/product'),
      },
    },
  },
})
