/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
  server: {
    host: '0.0.0.0',
    port: 3100,
    // Permitir todos los subdominios dinámicamente para multi-tenant
    // En producción, permite el dominio principal y cualquier subdominio (*.create.acceleralia.com)
    // En desarrollo, permite localhost y el dominio configurado
    allowedHosts: [
      'create.acceleralia.com',
      '.create.acceleralia.com', // Permite todos los subdominios: *.create.acceleralia.com
      'create.test.acceleralia.com',
      '.create.test.acceleralia.com', // Permite todos los subdominios: *.create.test.acceleralia.com
      'localhost',
      '127.0.0.1',
    ],
    // Deshabilitar HMR en producción
    hmr: mode === 'development',
  },
  // Asegurar que el build de producción no incluya código de desarrollo
  build: {
    // Eliminar comentarios y código muerto en producción
    minify: 'esbuild',
    // No incluir source maps en producción (opcional, mejora el rendimiento)
    sourcemap: false,
  },
}))
