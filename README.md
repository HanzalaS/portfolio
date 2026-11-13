# Hanzala Saeed – personal site

My personal site. It tells one idea as a short film: the moment something I built leaves my laptop and ends up in someone's hands. As you scroll, a laptop made of light dissolves, travels and lands in an open hand as a phone. Then come the work I've shipped, my writing and how I got here.

## Principles
- **The film is the story.** The particle film is drawn with three.js and loads only after the page is readable.
- **Readable without it.** Without JavaScript, without WebGL or with reduced motion turned on, every section still reads and works.
- **Privacy you can see.** No cookies, no analytics, nothing loaded from other companies. Fonts and libraries are self-hosted, and a strict Content-Security-Policy ships with every page. `scripts/check-origins.mjs` fails the build if an external resource or an inline script sneaks in.

## Built with
- [Astro](https://astro.build) 7, static output
- [three.js](https://threejs.org) for the particle film
- Inter Tight and Instrument Serif, self-hosted through Fontsource
- Plain CSS custom properties

## Run locally
Node 22.12 or newer is required (see `.nvmrc`).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/ and runs the origin check
```

## The old site
The previous single-page site lives in `legacy/` until the new one launches.

## License
The source code is licensed under the [MIT License](LICENSE). The writing, portrait and app screenshots are © Hanzala Saeed or their respective owners.
