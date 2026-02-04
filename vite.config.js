import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Badge/',
  build: {
    lib: {
      entry: './src/main.jsx',
      name: 'BadgeApp',
      formats: ['umd'],
      fileName: () => 'badge.js'
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
})