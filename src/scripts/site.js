// Page interactions. The page is fully readable without this file;
// it adds the scroll-driven film captions, the lit statement, card tilt and the particle film.

const root = document.documentElement;
root.classList.add('has-js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- articles: code that scrolls sideways can be reached by keyboard ---------- */
for (const pre of $$('.prose pre')) {
  pre.tabIndex = 0;
  pre.setAttribute('aria-label', `Code, ${pre.dataset.language || 'snippet'}`);
}

/* ---------- local time in Nuremberg ---------- */
const clock = $('#clock');
if (clock) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const tick = () => (clock.textContent = `${fmt.format(new Date())} in Nuremberg`);
    tick();
    setInterval(tick, 30000);
  } catch {
    clock.remove();
  }
}

/* ---------- hint copy ---------- */
const hintText = $('#hint-text');
if (hintText) {
  if (reduce) hintText.textContent = 'Scroll to follow it from laptop to hands.';
  else if (coarse) hintText.textContent = 'Touch the light. Tap to send a pulse.';
}

/* ---------- statement: words light up as you read ---------- */
const statement = $('#statement');
const words = [];
if (statement && !reduce) {
  const frag = document.createDocumentFragment();
  for (const n of Array.from(statement.childNodes)) {
    if (n.nodeType === 3) {
      for (const part of n.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          continue;
        }
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        frag.appendChild(s);
        words.push(s);
      }
    } else if (n.nodeType === 1) {
      n.classList.add('w');
      frag.appendChild(n);
      words.push(n);
    }
  }
  statement.textContent = '';
  statement.appendChild(frag);
}

/* ---------- touch: cards play their hover state when in view ---------- */
if (coarse && 'IntersectionObserver' in window) {
  const so = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target;
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          el._t = setTimeout(() => el.classList.add('solve'), reduce ? 0 : 500);
        } else if (!e.isIntersecting) {
          clearTimeout(el._t);
          el.classList.remove('solve');
        }
      }
    },
    { threshold: [0, 0.55] },
  );
  $$('.card, .post.big').forEach((el) => so.observe(el));
}

/* ---------- card tilt and glare ---------- */
if (!reduce && !coarse) {
  for (const card of $$('.card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - y) * 5).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }
}

/* ---------- copy email ---------- */
const copyBtn = $('#copy');
copyBtn?.addEventListener('click', () => {
  const email = copyBtn.getAttribute('data-email');
  const status = $('#copy-status');
  const done = () => {
    copyBtn.textContent = 'Copied';
    if (status) status.textContent = 'Email address copied';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
      if (status) status.textContent = '';
    }, 1600);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(email).then(done, () => (location.href = `mailto:${email}`));
  } else location.href = `mailto:${email}`;
});

/* ---------- scroll-driven UI ---------- */
const header = $('#top');
const film = $('#film');
const caps = $$('.cap');
const ticks = $$('.film-prog .tick');
const capWin = [
  [-1, 0.28],
  [0.4, 0.6],
  [0.76, 2],
];
const beliefs = $$('.beliefs li');
const route = $('#route');
const routeItems = $$('#route li');
let queued = false;

let lastLit = -1;
let lastAct = -1;

function ui() {
  queued = false;
  const vh = innerHeight;

  // Read every measurement first, then write, so the browser lays out only once per frame.
  const fr = film?.getBoundingClientRect();
  const sr = statement && words.length && !reduce ? statement.getBoundingClientRect() : null;
  const beliefRects = reduce ? [] : beliefs.map((li) => li.getBoundingClientRect());
  const rr = route?.getBoundingClientRect();
  const routeTops = routeItems.map((li) => li.getBoundingClientRect().top);

  header?.classList.toggle('scrolled', scrollY > 40);

  if (fr) {
    const fp = clamp(-fr.top / Math.max(1, fr.height - vh), 0, 1);
    let act = 0;
    caps.forEach((c, i) => {
      const w = capWin[i];
      let v = sstep(w[0] - 0.07, w[0], fp) * (1 - sstep(w[1], w[1] + 0.07, fp));
      if (reduce) v = v > 0.5 ? 1 : 0;
      if (v > 0.5) act = i;
      // Opacity only: the captions stay in the accessibility tree.
      c.style.opacity = v.toFixed(3);
      c.style.setProperty('--y', `${((1 - v) * 26).toFixed(1)}px`);
    });
    ticks.forEach((t, i) => {
      const f = clamp((fp - i / 3) * 3, 0, 1);
      t.querySelector('b').style.setProperty('--f', f.toFixed(3));
      t.classList.toggle('on', fp >= i / 3 - 0.001 && fp < (i + 1) / 3 + (i === 2 ? 1 : 0));
    });
    if (act !== lastAct) {
      root.classList.remove(`act-${lastAct}`);
      root.classList.add(`act-${act}`);
      lastAct = act;
    }
  }

  if (sr) {
    const p = clamp((vh * 0.86 - sr.top) / (sr.height + vh * 0.38), 0, 1);
    const lit = Math.round(p * words.length);
    if (lit !== lastLit) {
      words.forEach((w, i) => w.classList.toggle('lit', i < lit));
      lastLit = lit;
    }
  }

  if (beliefRects.length) {
    let best = -1;
    let bd = vh * 0.42;
    beliefRects.forEach((r, i) => {
      const d = Math.abs(r.top + r.height / 2 - vh * 0.5);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    beliefs.forEach((li, i) => {
      li.classList.toggle('on', i === best);
      li.classList.toggle('seen', i !== best && beliefRects[i].top + beliefRects[i].height / 2 < vh * 0.5);
    });
  }

  if (rr) {
    const rp = clamp((vh * 0.62 - rr.top) / Math.max(1, rr.height), 0, 1);
    route.style.setProperty('--p', reduce ? 1 : rp.toFixed(4));
    routeItems.forEach((li, i) => li.classList.toggle('on', reduce || routeTops[i] < vh * 0.66));
  }
}

const queueUI = () => {
  if (!queued) {
    queued = true;
    requestAnimationFrame(ui);
  }
};
addEventListener('scroll', queueUI, { passive: true });
addEventListener('resize', queueUI);
ui();

/* ---------- the particle film: loaded after the page is readable ---------- */
// Without WebGL the film is shorter and the CSS glow carries the story from amber to blue.
function fallBack() {
  root.classList.remove('gl-on');
  root.classList.add('gl-off');
  queueUI();
}

const canvas = $('#gl');
if (canvas && film) {
  const start = () =>
    import('./film.js')
      .then(({ initFilm }) => {
        const ok = initFilm({
          canvas,
          film,
          about: $('#about'),
          contact: $('#contact'),
          reduce,
          coarse,
          onLost: fallBack,
          onRestored: () => {
            root.classList.remove('gl-off');
            root.classList.add('gl-on');
          },
        });
        if (ok) root.classList.add('gl-on');
        else fallBack();
      })
      .catch(fallBack);
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
}
