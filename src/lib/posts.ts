import type { CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import siteConfig from '../data/site.config.json';

export type BlogPost = CollectionEntry<'posts'>;
export type PostCover = string | ImageMetadata;

export const site = {
  name: siteConfig.siteName,
  description: siteConfig.siteDescription,
  // 带 PUBLIC_ 前缀的环境变量才会暴露给 import.meta.env（.env 文件与平台注入均生效）。
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://saibo.me',
  author: siteConfig.siteAuthor,
};

const getTime = (date?: Date) => date?.getTime() ?? 0;

export const sortPosts = (posts: BlogPost[]) =>
  [...posts].sort((a, b) => {
    const stickyDiff = (b.data.sticky ?? 0) - (a.data.sticky ?? 0);

    if (stickyDiff !== 0) {
      return stickyDiff;
    }

    const dateDiff = getTime(b.data.date) - getTime(a.data.date);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return a.data.title.localeCompare(b.data.title, 'zh-CN');
  });

export const sortPostsByDate = (posts: BlogPost[]) =>
  [...posts].sort((a, b) => {
    const dateDiff = getTime(b.data.date) - getTime(a.data.date);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return a.data.title.localeCompare(b.data.title, 'zh-CN');
  });

export const formatDate = (date?: Date) => {
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getPostDescription = (post: BlogPost) =>
  post.data.description ?? post.data.ai?.[0] ?? '技术记录与实践笔记。';

// Real excerpt only — undefined instead of the generic filler, so list rows
// can omit the line rather than repeat boilerplate under every old post.
export const getPostExcerpt = (post: BlogPost) =>
  post.data.description ?? post.data.ai?.[0];

export const getPostCategory = (post: BlogPost) => post.data.categories?.[0];

export const getPostTags = (post: BlogPost) => post.data.tags ?? [];

// cover 字段两种形态统一成渲染用的 URL 字符串：
//  - 本地 image() 元数据 → .src
//  - 纯字符串外链 / 绝对路径 → 原样返回
//  - 缺失 → undefined
export const getPostCover = (post: BlogPost): string | undefined => {
  const c = post.data.cover;
  if (!c) return undefined;
  return typeof c === 'string' ? c : c.src;
};

// Post URL "slug" — short, flat, final segment shown at site root.
// Priority:
//   1. explicit frontmatter `slug:`  → user controls it exactly
//   2. last path segment of post.id  → e.g. 技术/theme-switch → theme-switch
// Note: post.id itself stays as the full "folder/subfolder/name" identity for
// internal lookups (adjacent/related/slug-matching), only URLs go flat.
export const getPostSlug = (post: BlogPost) => {
  const explicit = post.data.slug?.trim();
  if (explicit) return explicit;
  const id = post.id;
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? id : id.slice(lastSlash + 1);
};

export const getPostPath = (post: BlogPost) => `/${getPostSlug(post)}`;

// === 扁平 slug 安全检查 =====================================================
//
// 把扁平 URL 可能跟站内保留路径 / 其他文章 slug 撞上的情况，在 build 时
// 用可读的错误信息提前报出来，避免作者在部署后才遇到静默 shadow 或
// Astro 那串晦涩的 "duplicate params in getStaticPaths" 报错。
//
// 保留名规则：
//   - /pages/*.astro / pages/*.ts 生成的顶层路由名（about / notes / …）
//   - 动态子路由的目录名（categories / tags / posts），避免以后新增
//     分类落地页 /categories 时和某文章 slug 打架
//   - 顶层端点的输出文件名（rss.xml / sitemap.xml / robots.txt / search.json）
//   - 常见保留名：favicon / api / admin / assets 这类未来可能要用的
export const RESERVED_FLAT_SLUGS: ReadonlySet<string> = new Set([
  // pages/*.astro 顶层静态页
  'about',
  'archive',
  'notes',
  'search',
  '404',
  // pages/ 下动态路由的目录名（保留命名空间）
  'categories',
  'tags',
  'posts',
  // pages/*.ts 端点的输出文件名
  'rss.xml',
  'sitemap.xml',
  'robots.txt',
  'search.json',
  // 常见通用保留名
  'favicon',
  'api',
  'admin',
  'assets',
  '_redirects',
  'index',
]);

// 历史上删除过、但仍需要把旧 URL 重定向到某处的"遗留入口"。
// 仅填：site.config 里仍在引用 / 或曾经对外发过外链的文章。
// oldId  格式 = 旧 post.id（例如 技术/deploy-static）
// newSlug 格式 = 新扁平 slug（不带 /），null 表示内容已删除，重定向到首页
// title   用于错误/渲染信息
export interface DeletedPostRedirect {
  oldId: string;
  newSlug: string | null;
  title?: string;
}

export const DELETED_POST_REDIRECTS: readonly DeletedPostRedirect[] = [
  // site.config.json projectGroups 还在引用 /deploy-static 作为文章链接，
  // 虽然源文件已删除，保留旧路径到首页的软跳转，不让配置里的链接直接 404。
  { oldId: '技术/deploy-static', newSlug: null, title: '静态站点部署实践' },
];

export const validatePostSlugs = (posts: BlogPost[]) => {
  const bySlug = new Map<string, BlogPost[]>();
  for (const post of posts) {
    const slug = getPostSlug(post);
    if (RESERVED_FLAT_SLUGS.has(slug)) {
      throw new Error(
        `[博客] slug 保留名冲突：\n  文章《${post.data.title}》 (id=${post.id})\n  最终 slug="${slug}" 与站内保留路径冲突。\n  保留名完整列表: ${[...RESERVED_FLAT_SLUGS].sort().join(', ')}\n\n请在 frontmatter 显式写一个不同的 slug: 字段，或修改文件名。`,
      );
    }
    const arr = bySlug.get(slug) ?? [];
    arr.push(post);
    bySlug.set(slug, arr);
  }
  const collisions = [...bySlug.entries()].filter(([, arr]) => arr.length > 1);
  if (collisions.length > 0) {
    const details = collisions
      .map(([slug, dupPosts]) => {
        const list = dupPosts
          .map((p) => `    · ${p.id}  《${p.data.title}》`)
          .join('\n');
        return `  · slug "${slug}" 被以下 ${dupPosts.length} 篇文章共用：\n${list}`;
      })
      .join('\n');
    throw new Error(
      `[博客] 发现 ${collisions.length} 组 slug 碰撞（多文章产生了同一个扁平 URL）：\n${details}\n请在 frontmatter 用显式 slug: 字段区分，或重命名冲突的 md 文件名。`,
    );
  }
};

export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

export const getPostUrl = (post: BlogPost) => absoluteUrl(getPostPath(post));

export const getPostUpdatedDate = (post: BlogPost) =>
  post.data.updated ?? post.data.date;

export const getReadingMinutes = (post: BlogPost) => {
  const body = (post as BlogPost & { body?: string }).body ?? '';
  const cjkChars = body.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = body
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const readingUnits = cjkChars + words;

  return Math.max(1, Math.ceil(readingUnits / 350));
};

export const getAdjacentPosts = (posts: BlogPost[], currentPost: BlogPost) => {
  const orderedPosts = sortPostsByDate(posts);
  const index = orderedPosts.findIndex((post) => post.id === currentPost.id);

  return {
    newer: index > 0 ? orderedPosts[index - 1] : undefined,
    older:
      index >= 0 && index < orderedPosts.length - 1
        ? orderedPosts[index + 1]
        : undefined,
  };
};

export const getRelatedPosts = (
  posts: BlogPost[],
  currentPost: BlogPost,
  limit = 3,
) => {
  const currentCategory = getPostCategory(currentPost);
  const currentTags = new Set(getPostTags(currentPost));

  return sortPostsByDate(posts)
    .filter((post) => post.id !== currentPost.id)
    .map((post) => {
      const sharedTags = getPostTags(post).filter((tag) => currentTags.has(tag));
      const sameCategory =
        currentCategory && getPostCategory(post) === currentCategory ? 1 : 0;

      return {
        post,
        score: sameCategory * 3 + sharedTags.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
};

const countItems = (items: string[]) =>
  items.reduce<Map<string, number>>((counts, item) => {
    const name = String(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    return counts;
  }, new Map());

const mapToSortedTerms = (counts: Map<string, number>) =>
  [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

export const getCategories = (posts: BlogPost[]) =>
  mapToSortedTerms(
    countItems(posts.flatMap((post) => post.data.categories ?? [])),
  );

export const getTags = (posts: BlogPost[]) =>
  mapToSortedTerms(countItems(posts.flatMap((post) => getPostTags(post))));

export const getCategoryPath = (category: string) =>
  `/categories/${encodeURIComponent(category)}`;

export const getTagPath = (tag: string) =>
  `/tags/${encodeURIComponent(tag)}`;

export const getPostsByCategory = (posts: BlogPost[], category: string) =>
  sortPosts(posts).filter((post) => post.data.categories?.includes(category));

export const getPostsByTag = (posts: BlogPost[], tag: string) =>
  sortPosts(posts).filter((post) => getPostTags(post).includes(tag));

export const groupPostsByYear = (posts: BlogPost[]) => {
  const groups = new Map<string, BlogPost[]>();

  for (const post of sortPosts(posts)) {
    const year = post.data.date?.getFullYear().toString() ?? '未注明日期';
    groups.set(year, [...(groups.get(year) ?? []), post]);
  }

  return [...groups.entries()].map(([year, yearPosts]) => ({
    year,
    posts: yearPosts,
  }));
};
