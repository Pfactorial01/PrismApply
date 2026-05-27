import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

const site = process.env.PUBLIC_SITE_URL ?? 'https://prismapply.com'

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site,
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
})
