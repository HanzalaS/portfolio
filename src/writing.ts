import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'writing'>;

/** All articles, newest first. */
export async function articles(): Promise<Article[]> {
  return (await getCollection('writing')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** "Oct 2026" on cards, "9 October 2026" on the article itself. */
export const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Reading time from the prose, leaving code out so a long snippet doesn't inflate it. */
export function minutes(entry: Article): number {
  const prose = (entry.body ?? '').replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>|^import .*$/gm, '');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
