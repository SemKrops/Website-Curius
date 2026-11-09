// Instellingen voor Astro, het programma dat de website bouwt.
// SITE_URL en BASE_PATH worden in GitHub Actions ingevuld (zie .github/workflows).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://semkrops.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    concurrency: 4,
  },
  devToolbar: { enabled: false },
});
