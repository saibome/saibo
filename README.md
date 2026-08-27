# saibo

基于 Astro 的个人博客，内容使用 Markdown 管理，包含文章、随笔、归档、分类、标签、搜索、RSS、站点地图和 Twikoo 后端评论。使用 Node.js 作为运行时，pnpm 作为包管理器（`package.json` 已声明 `packageManager: pnpm@11.10.0`）。

## 项目结构

```
saibo/
├── public/                # 静态资源
│   ├── avatars/           # 头像
│   └── covers/            # 封面图加载失败时的兜底图
├── src/
│   ├── components/        # 组件（导航、页脚、评论等）
│   ├── layouts/           # 页面布局
│   ├── pages/             # 路由页面（首页、归档、搜索、RSS 等）
│   ├── content/
│   │   ├── posts/         # 文章（Markdown）
│   │   └── notes/         # 随笔（Markdown）
│   ├── data/
│   │   ├── site.config.json      # 站点与关于页配置（见下文）
│   │   └── github-projects.json  # GitHub 项目缓存
│   ├── lib/               # 工具函数与 Markdown 插件
│   └── styles/            # 全局样式（主题色变量在此定义）
├── astro.config.mjs       # Astro 配置
├── pnpm-lock.yaml         # pnpm 依赖锁定文件
└── package.json
```

## 快速开始

**环境要求：Node.js（>= 18.20 或 >= 20.3 或 >= 22）与 pnpm。** 不需要单独安装 Astro——Astro 是项目依赖，`pnpm install` 时会自动装好。

> 推荐用 Node.js 自带的 **Corepack** 启用 pnpm（无需全局安装 pnpm）：`corepack enable` 会让 `pnpm` 命令可用，并自动对齐 `package.json` 里声明的版本。

第一次使用，按顺序执行：

```bash
# 1. 安装 Node.js（未安装时）：到 https://nodejs.org/ 下载 LTS 版本安装
#    Node 自带 npm 与 Corepack

# 2. 启用 pnpm（只需执行一次）
corepack enable

# 3. 下载项目
git clone https://github.com/saibome/saibo.git
cd saibo

# 4. 安装依赖（自动安装 Astro）
pnpm install

# 5. 启动本地预览
pnpm run dev
```

浏览器打开 `http://localhost:4321` 即可看到博客。修改 `src/content/` 下的 Markdown 后保存，页面会热更新。

## 构建

```bash
pnpm run build
pnpm run preview
```

构建产物输出到 `dist/`，可部署到任意静态托管平台。

## 部署

1. 连接仓库（Vercel / Netlify / Cloudflare Pages / GitHub Pages 均可），构建命令 `pnpm install && pnpm run build`，输出目录 `dist`
   - 若托管平台默认支持 pnpm，通常可简写为 `pnpm run build`；不支持时可先启用 Corepack（见「常见问题」）
2. 在平台环境变量中设置 `PUBLIC_SITE_URL` 为正式域名
3. 自定义域名按平台指引添加 DNS 解析（CNAME 记录）
4. 若旧域名需要迁移，在平台侧配置 301 重定向

更详细的说明见示例文章《静态站点的部署实践》。

## 环境变量

复制 `.env.example` 为 `.env`，按需填写：

```bash
PUBLIC_SITE_URL=https://saibo.me
PUBLIC_TWIKOO_ENV_ID=https://your-twikoo.example.com
```

- `PUBLIC_SITE_URL`：站点正式域名，用于 RSS、sitemap、canonical URL 和结构化数据。必须带 `PUBLIC_` 前缀，否则 Astro 不会暴露给 `import.meta.env`。
- `PUBLIC_TWIKOO_ENV_ID`：Twikoo 后端地址。未配置时，评论区和选中文字引用评论功能会自动隐藏。

## 内容

- 文章：`src/content/posts/`
- 随笔：`src/content/notes/`
- 内容字段定义：`src/content.config.ts`

文章和随笔会在构建时生成静态页面。若使用自定义 `slug`，需要保证唯一，避免内容集合覆盖。

> **注意**：文件名中不要带点（如 `xxx.blog.md`），点会被当作扩展名分隔符导致 slug 丢字。建议用 `xxx.md` 或纯英文名。

仓库自带一组**示例文章与随笔**（`示例/`、`AI/`、`技术/` 分类），用于演示首页、分类、标签、归档、搜索与 RSS 等页面的完整效果；封面图引用图床占位图。使用前请直接删除这些示例文件，换成自己的内容。

## 自定义

克隆后需要改的地方，全部集中在这几个文件：

| 要改的内容 | 位置 |
| --- | --- |
| 站点名称 / 简介 / 作者 | [src/data/site.config.json](src/data/site.config.json) 的 `siteName` / `siteDescription` / `siteAuthor` |
| 头像 | 替换 `public/avatars/avatar.png` 与 `avatar-bw.png` |
| 主题色 | [src/styles/global.css](src/styles/global.css) 的 `--brand` 变量（浅色与深色模式各一处） |
| GitHub 用户名与项目展示 | [src/data/site.config.json](src/data/site.config.json) 的 `githubUser`（关于页构建时拉取该账号仓库） |
| 正式域名 | 复制 `.env.example` 为 `.env`，设置 `PUBLIC_SITE_URL` |
| 评论后端 | `.env` 的 `PUBLIC_TWIKOO_ENV_ID`（不配则评论自动隐藏） |
| 页脚备案号 | [src/components/Footer.astro](src/components/Footer.astro) 的备案链接 |
| 文章与随笔 | 删除 `src/content/posts/` 下的 `示例/`、`AI/`、`技术/` 目录和 `src/content/notes/` 下的示例随笔，换成自己的 Markdown |

改完 `site.config.json` 后重新 `pnpm run dev` 即可生效。

## 关于页配置

关于页的开源项目与资源下载均通过 [src/data/site.config.json](src/data/site.config.json) 配置：

```jsonc
{
  // GitHub 用户名：构建时自动拉取该账号的公开仓库作为「开源项目」
  "githubUser": "saibome",
  // 按仓库名覆盖卡片细节：icon 为卡片图标（见 src/components/Icon.astro 的图标名），
  // article 为指向博客内相关文章的「笔记」链接（不填则不显示该按钮）
  "projectOverrides": {
    "md-wechat": { "icon": "wechat" },
    "Steam-game-cover-gets": { "icon": "download", "article": "/posts/ai-era/github/steamcovr/" }
  },
  // 静态项目组（如「资源下载」），可直接增删条目或整组
  "projectGroups": [
    {
      "title": "资源下载",
      "description": "文章里提到的网盘、脚本和可复用资料。",
      "items": [
        {
          "title": "Bookmarklet 小书签",
          "owner": "Baidu Pan",
          "description": "浏览器小书签源码与使用说明，适合做轻量自动化。",
          "icon": "bookmark",
          "href": "https://pan.baidu.com/s/1olHsMYzcOtGCYiY6nUs6eQ?pwd=6666",
          "article": "/posts/book/",
          "tags": ["书签", "脚本", "code:6666"]
        }
      ]
    }
  ]
}
```

「开源项目」组在构建时从 GitHub API 拉取（自动排除 fork，按 Star 数排序），新增仓库重新构建即可自动出现；API 不可达时回退到 [src/data/github-projects.json](src/data/github-projects.json) 缓存，可用以下命令手动刷新（将 `saibome` 替换为你的 GitHub 用户名）：

```bash
curl -s "https://api.github.com/users/saibome/repos?per_page=100" -o src/data/github-projects.json
```

## 评论

评论前端没有使用 Twikoo 的默认 UI，而是通过 `src/lib/comments.js` 调用 Twikoo 后端接口并渲染自定义样式。

文章正文支持选中文字后引用到底部评论区：

1. 确认 `.env` 已配置 `PUBLIC_TWIKOO_ENV_ID`，否则评论区和引用按钮都会隐藏。
2. 在文章正文或随笔正文中拖选至少 2 个字符。
3. 选区上方会出现"引用评论"按钮。
4. 点击按钮后页面会滚动到底部评论区，并把选中的文字以 Markdown blockquote 写入评论框。
5. 发送成功后页面会回到刚才的阅读位置。

## 常见问题

**怎么启用 pnpm？**
Node.js >= 16.17 自带 Corepack，运行 `corepack enable` 即可（会读取 `package.json` 的 `packageManager` 字段并自动用对应版本的 pnpm）。也可以全局安装：`npm install -g pnpm`。

**Astro 需要单独安装吗？**
不需要。Astro 是 `package.json` 里的依赖，`pnpm install` 自动安装，无需全局安装任何东西。

**`pnpm install` 很慢 / 失败？**
国内网络可切换到镜像源：

```bash
pnpm config set registry https://registry.npmmirror.com
```

**端口被占用？**
`pnpm run dev -- --port 4322` 指定其他端口。

**本地预览域名还是 example.com？**
环境变量在 dev server 启动时读取，改完 `.env` 需重启 `pnpm run dev` 才会生效。

**构建平台（Vercel/Netlify 等）报 `pnpm: command not found`？**
在构建命令前加一步：`corepack enable`（或 `npm i -g pnpm`），例如完整构建命令：`corepack enable && pnpm install && pnpm run build`。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。仓库自带的示例文章与随笔仅用于演示，可直接删除替换。
