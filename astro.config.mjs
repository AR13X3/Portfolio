// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves this repo on its custom domain, https://toufiqahmedjoy.online/ (public/CNAME).
// Override with SITE_URL / BASE_PATH env vars to serve it elsewhere, e.g. under a path.
export default defineConfig({
  site: process.env.SITE_URL || 'https://toufiqahmedjoy.online',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
