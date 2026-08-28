import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeImgAttrs from './src/lib/rehype-img-attrs.mjs';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://saibo.me',
  redirects: {
    '/projects': '/about',
  },
  markdown: unified({
    rehypePlugins: [rehypeImgAttrs],
  }),
});
