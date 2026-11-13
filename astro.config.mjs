// @ts-check
import { defineConfig } from 'astro/config';

// Static site, no server code. Stylesheets are always emitted as files so the
// Content-Security-Policy can stay at `style-src 'self'` with no inline styles.
// The site is served from GitHub Pages at https://hanzalas.github.io/portfolio/.
// With a custom domain later, set `site` to it and `base` to '/'.
export default defineConfig({
  site: 'https://hanzalas.github.io',
  base: '/portfolio',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'never',
  },
  devToolbar: {
    enabled: false,
  },
  vite: {
    build: {
      // Never inline small assets as data: URIs; the CSP only allows files from this site.
      assetsInlineLimit: 0,
    },
  },
});
