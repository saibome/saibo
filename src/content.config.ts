import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stringList = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return [String(value)];
}, z.array(z.string()).default([]));

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/posts',
    // 支持"一篇一个文件夹"包结构：技术/deploy-static/index.md → id 为 技术/deploy-static
    // 传统平铺写法也兼容：技术/deploy-static.md → id 为 技术/deploy-static
    generateId: ({ entry }) => entry.replace(/\.md$/, '').replace(/\/index$/, ''),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string().optional(),
        date: z.coerce.date().optional(),
        updated: z.coerce.date().optional(),
        // cover 三种写法均支持（按顺序匹配，string 在前避免 image() 误解析路径）：
        //  - 站内绝对路径：/covers/example.jpg（public/ 下的静态资源）
        //  - 外链：https://cdn.example.com/xxx.jpg
        //  - 本地相对路径（推荐）：./cover.jpg → Astro 自动校验存在+构建时优化
        cover: z
          .union([
            z.string().startsWith('/'),
            z.string().url(),
            image(),
          ])
          .optional(),
        categories: stringList,
        tags: stringList,
        keywords: stringList,
        ai: stringList,
        sticky: z.coerce.number().optional(),
        author: z.string().optional(),
      })
      .passthrough(),
});

const notes = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/notes',
    generateId: ({ entry }) => entry.replace(/\.md$/, '').replace(/\/index$/, ''),
  }),
  schema: z
    .object({
      date: z.coerce.date(),
      title: z.string().optional(),
      mood: z.string().optional(),
      tags: stringList,
    })
    .passthrough(),
});

export const collections = { posts, notes };
