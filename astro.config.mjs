import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeImgAttrs from './src/lib/rehype-img-attrs.mjs';
import rehypeLegacyShortcodes from './src/lib/rehype-legacy-shortcodes.mjs';
import remarkLegacyShortcodes from './src/lib/remark-legacy-shortcodes.mjs';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://saibo.me',
  redirects: {
    '/projects': '/about',
  },
  markdown: unified({
    remarkPlugins: [remarkLegacyShortcodes],
    rehypePlugins: [rehypeLegacyShortcodes, rehypeImgAttrs],
  }),
});
