import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  const m = arg.match(/^--([\w-]+)=(.*)$/);
  if (m) {
    flags[m[1]] = m[2];
  } else {
    positional.push(arg);
  }
}

const title = positional[0];
const slugArg = positional[1];

if (!title) {
  console.error('用法: bun run new "文章标题" [slug] [--category=分类] [--tags=标签1,标签2] [--cover=图片地址] [--flat]');
  console.error('  默认：一篇一个文件夹 <slug>/index.md + 同级图片');
  console.error('  --flat：平铺生成 <slug>.md（旧格式）');
  process.exit(1);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 从标题生成 slug：保留中英文、数字、连字符；过滤文件名中会导致问题的点号等字符
function slugify(text) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Script=Han}\w-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `post-${Date.now()}`;
}

function toList(value) {
  if (!value) return [];
  return value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function yamlList(items) {
  return items.length ? items.map((s) => `  - ${s}`).join('\n') : '[]';
}

const slug = slugify(slugArg || title);
const category = flags.category || '';
const flat = 'flat' in flags;
const dir = category
  ? join('src', 'content', 'posts', category, flat ? '' : slug)
  : join('src', 'content', 'posts', flat ? '' : slug);
const filePath = join(dir, flat ? `${slug}.md` : 'index.md');

// 文件夹模式下：检查目录（含其中任意 md 文件）和 slug 平铺 md 两种冲突
const collision = flat
  ? existsSync(filePath) || existsSync(join(dir, slug, 'index.md'))
  : existsSync(filePath) || existsSync(join(category ? join('src','content','posts',category) : join('src','content','posts'), `${slug}.md`));

if (collision) {
  console.error(`文件已存在: ${filePath}（或对应旧/新格式同名文件）`);
  process.exit(1);
}

const date = today();
const tags = toList(flags.tags);
const tagItems = tags.length ? tags : [category];
const cover = flags.cover || '/covers/default-cover.svg';
const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
description: ""
date: "${date}"
cover: ${cover}
categories: ${category}
tags:
${yamlList(tagItems)}
---
`;

mkdirSync(dirname(filePath), { recursive: true });
writeFileSync(filePath, `${frontmatter}\n${title}\n`, 'utf8');
console.log(`已创建: ${filePath}`);
