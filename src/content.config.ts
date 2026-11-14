import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Articles, written once and kept here. Each one links back to where it first appeared.
const writing = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    /** One line in my own voice, shown on cards and as the page description. */
    excerpt: z.string(),
    date: z.coerce.date(),
    /** Where it was first published. */
    origin: z.object({ name: z.string(), url: z.url() }),
    featured: z.boolean().default(false),
  }),
});

export const collections = { writing };
