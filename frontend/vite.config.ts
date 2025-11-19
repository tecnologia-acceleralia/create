import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
  },
})
