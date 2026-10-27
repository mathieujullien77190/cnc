import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// GitHub Pages sert le site sous /cnc/
export default defineConfig(({ command }) => ({ base: command === 'build' ? '/cnc/' : '/', plugins: [react(), tailwindcss()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } }))
