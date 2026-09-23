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
        // 显式 slug 优先于文件名推导：
        //   - 写了 slug: hello → 最终访问路径 /hello
        //   - 没写 → 取 post.id 最后一段（去掉子目录，如 技术/theme-switch → theme-switch）
        // 允许字符：ASCII 字母/数字、中文、连字符、下划线、点（兼容 260609-agent.blog 这种 ID 末段）
        // 明确禁止：/ \ 空格 ? # % & @ = + , ; : 反引号 尖括号 以及控制字符
        slug: z
          .string()
          .trim()
          .regex(
            /^[A-Za-z0-9\u4e00-\u9fff._-]+$/,
            'slug 仅允许中英文、数字、连字符(-)、下划线(_)和点(.)；不可含斜杠/空格/?/#等',
          )
          .optional(),
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
