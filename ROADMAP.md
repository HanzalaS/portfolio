# Roadmap

The site is currently one 2,900-line `index.html` that loads Tailwind from its CDN. It has 13 MB of unoptimized PNG screenshots and no build step or tests. This roadmap turns it into a fast, maintainable static site with a working blog.

Hour estimates are rough.

## 1. Move to a real build setup (~6h)
- [ ] Migrate to Astro (static output) and keep GitHub Pages deployment
- [ ] Replace the Tailwind Play CDN with a compiled Tailwind build (the CDN is not meant for production)
- [ ] Split `index.html` into components: Hero, About, Education, Skills, Projects, Testimonials, Blog, CV, Contact
- [ ] Pin third-party library versions (Swiper, AOS, Font Awesome) as npm dependencies instead of CDN links

## 2. Content as data (~4h)
- [ ] Move projects, skills, education and testimonials into typed content files (Astro content collections)
- [ ] Give each project its own case-study page: problem, my role, stack, screenshots, outcome
- [ ] Make adding a new project a content-only change, with no HTML edits

## 3. Blog (~5h)
- [ ] Replace the static blog section with Markdown/MDX posts
- [ ] Post list, tags, reading time, RSS feed
- [ ] Code syntax highlighting for Flutter/Dart snippets
- [ ] Write the first two posts (Flutter payment integration; background location tracking)

## 4. Performance (~4h)
- [ ] Convert screenshots to WebP/AVIF with responsive sizes (target: total image weight under 2 MB)
- [ ] Lazy-load images below the fold and add width/height to prevent layout shift
- [ ] Self-host fonts and icons, removing render-blocking CDN CSS
- [ ] Reach a Lighthouse performance score of 95 or more on mobile

## 5. Accessibility and SEO (~4h)
- [ ] Fix missing/empty `alt` text and check heading order and color contrast
- [ ] Keyboard navigation and visible focus states for the carousels and theme toggle
- [ ] Respect `prefers-reduced-motion` for AOS animations
- [ ] Meta description, Open Graph/Twitter cards, favicon set, `sitemap.xml`, JSON-LD `Person` schema

## 6. Contact form (~2h)
- [ ] Replace the `mailto:` form with a static-form handler (keys kept in environment variables, never committed)
- [ ] Client-side validation, spam honeypot, success and error states

## 7. Quality and CI (~5h)
- [ ] Playwright smoke tests: each section renders, theme toggle works, nav links resolve, contact form validates
- [ ] Automated accessibility checks (axe) in the test run
- [ ] GitHub Actions: lint, build, test and Lighthouse CI on every pull request, then deploy to Pages from `main`
- [ ] Broken-link check on the built site

**Total: about 30 hours**
