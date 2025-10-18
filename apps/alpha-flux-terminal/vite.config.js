/**
 * ============================================================================
 * ARCHIVO: ./apps/alpha-flux-terminal/vite.config.js
 * SERVICIO: alpha-flux-terminal
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: vite, @vitejs/plugin-react, path
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - vite
 *   - @vitejs/plugin-react
 *   - path
 * 
 * ============================================================================
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
