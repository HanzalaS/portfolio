// Fails the build if any built file loads a resource from another origin, or if a page ships an inline script.
// Scripts are allowed only as files served from this site.
// Ordinary outbound links (<a href>) are fine: they load nothing until clicked.
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TEXT = new Set(['.html', '.css', '.svg', '.xml', '.json', '.webmanifest', '.js', '.mjs', '.txt']);

// Any scheme (http:, https:, data:, javascript:, ...) or a protocol-relative "//host" or "/\host".
// The CSP allows only 'self', so data: URIs are blocked too and count as problems here.
const external = (v) => /^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i.test(v.trim());

const LOADING_ATTRS = new Set([
  'src', 'href', 'srcset', 'imagesrcset', 'poster', 'data', 'action', 'formaction', 'background', 'xlink:href', 'ping',
]);

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(p);
    else yield p;
  }
}

const problems = [];

for await (const file of files(DIST)) {
  const ext = extname(file).toLowerCase();
  if (!TEXT.has(ext)) continue;
  const text = await readFile(file, 'utf8');
  const rel = file.slice(DIST.length);

  if (ext === '.js' || ext === '.mjs') {
    // Bundled scripts may not reach out: no external imports or hard-coded remote URLs to load.
    for (const m of text.matchAll(/\bimport\s*\(?\s*['"]((?:https?:)?\/\/[^'"]+)['"]/g)) problems.push(`${rel}: imports ${m[1]}`);
    for (const m of text.matchAll(/\bfetch\s*\(\s*['"]((?:https?:)?\/\/[^'"]+)['"]/g)) problems.push(`${rel}: fetches ${m[1]}`);
    continue;
  }

  if (ext === '.html' || ext === '.svg' || ext === '.xml') {
    // Tags, respecting quoted attribute values that may contain ">".
    for (const tag of text.matchAll(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
      const name = tag[1].toLowerCase();
      const attrs = tag[2];
      if (name === 'script' && !/\ssrc\s*=/.test(attrs)) problems.push(`${rel}: contains an inline <script>`);
      if (name === 'style' && ext === '.html') problems.push(`${rel}: contains an inline <style> (blocked by style-src 'self')`);

      for (const attr of attrs.matchAll(/\s([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g)) {
        const key = attr[1].toLowerCase();
        const value = attr[2].replace(/^["']|["']$/g, '');

        if (/^on/.test(key)) problems.push(`${rel}: inline event handler ${key}= on <${name}> (blocked by the CSP)`);
        if (key === 'style' && ext === '.html') problems.push(`${rel}: inline style= on <${name}> (blocked by style-src 'self')`);

        // A plain link loads nothing, but <a ping> does.
        if (name === 'a' && key !== 'ping') continue;
        // <link rel="canonical|alternate|me"> only names a URL; it loads nothing.
        if (name === 'link' && key === 'href' && /\srel\s*=\s*["']?(canonical|alternate|me)\b/i.test(attrs)) continue;

        if (key === 'style' && /url\(/i.test(value)) {
          for (const m of value.matchAll(/url\(\s*['"]?([^'")]+)/gi)) if (external(m[1])) problems.push(`${rel}: style url(${m[1]})`);
        }
        if (name === 'meta' && key === 'content' && /http-equiv\s*=\s*["']?refresh/i.test(attrs)) {
          const m = value.match(/url\s*=\s*(.+)$/i);
          if (m && external(m[1])) problems.push(`${rel}: meta refresh to ${m[1]}`);
        }
        if (!LOADING_ATTRS.has(key)) continue;

        const values = key.endsWith('srcset') || key === 'ping'
          ? value.split(/[,\s]+/).filter((v) => v && !/^\d+(\.\d+)?[wx]$/.test(v))
          : [value];
        for (const v of values) if (external(v)) problems.push(`${rel}: <${name} ${key}="${v}">`);
      }
    }
  }

  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    if (external(m[1])) problems.push(`${rel}: url(${m[1]})`);
  }
  for (const m of text.matchAll(/@import\s+(?:url\()?\s*['"]?([^'");\s]+)/gi)) {
    if (external(m[1])) problems.push(`${rel}: @import ${m[1]}`);
  }
}

if (problems.length) {
  console.error(`check-origins: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('check-origins: every resource is served from this site, and no page ships an inline script.');
