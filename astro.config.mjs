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
  image: {
    // Markdown ![]() 和本地封面图默认响应式：按设备像素密度生成 srcset
    layout: 'constrained',
    // 注入 height:auto / max-width:100% / aspect-ratio 内联样式，
    // 与 global.css 里的 .post-content img 规则兼容（CSS 会覆盖/补充样式）
    responsiveStyles: true,
  },
});
