/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BrowserRouter needs an absolute base; CI sets VITE_BASE to /<repo>/ for GitHub Pages.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: { environment: 'node' },
})
