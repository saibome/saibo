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
        // cover 支持本地图片（自动校验存在+构建时优化转WebP）和纯字符串外链
        cover: z
          .union([image(), z.string().url()])
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
