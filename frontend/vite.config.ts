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
    // Dividir el bundle en chunks más pequeños para mejorar el rendimiento
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separar vendor libraries grandes
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // React Query
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            // i18n
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n';
            }
            // Radix UI (muy grande, separarlo completamente)
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            // CodeMirror (editor de código, grande)
            if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) {
              return 'codemirror-vendor';
            }
            // Chart libraries (grandes)
            if (id.includes('recharts')) {
              return 'chart-vendor';
            }
            // Calendar libraries (grandes)
            if (id.includes('react-big-calendar') || id.includes('react-calendar') || id.includes('react-day-picker')) {
              return 'calendar-vendor';
            }
            // UI libraries más pequeñas
            if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('sonner')) {
              return 'ui-vendor';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor';
            }
            // Date libraries
            if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
              return 'date-vendor';
            }
            // Otras librerías grandes
            if (id.includes('embla-carousel') || id.includes('react-resizable-panels') || id.includes('cmdk') || id.includes('vaul')) {
              return 'ui-vendor';
            }
            // Utilidades comunes
            if (id.includes('axios') || id.includes('class-variance-authority') || id.includes('tailwind-merge') || id.includes('clsx') || id.includes('input-otp') || id.includes('next-themes')) {
              return 'utils-vendor';
            }
            // Resto de vendor libraries
            return 'vendor';
          }
        },
      },
    },
  },
}))
