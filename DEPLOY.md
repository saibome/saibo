# clay-blog 部署到阿里云服务器（1Panel 面板）

本项目是**纯静态 Astro 站点**（无 SSR、无服务端 adapter），`bun run build` 后产物全部在 `dist/`，
所以部署 = `dist/` 放到服务器 + Nginx/OpenResty 托管 + 域名 HTTPS。

实测数据：40 个页面、53 个文件、2.7MB，构建 3 秒，rsync 增量同步通常 1～2 秒。

---

## 零、先搞清楚一件事：你的站点目录到底在哪

1Panel 静态站点的内容目录，宿主机路径一般是：

```
/opt/1panel/apps/openresty/openresty/www/sites/{站点代号}/index/
                                                       ^^^^^^
                                               文件必须放进 index 里，不是放外层
```

容器内的对应路径是 `/www/sites/{站点代号}/index`。

> ⚠️ 不同版本/不同安装目录可能不一样。**以面板显示的为准**：
> 1Panel → 网站 → 点你的站点名 → 看「网站目录」，点进去确认 `index` 文件夹的完整路径，
> 把它填到 `deploy.sh` 的 `REMOTE_DIR`。

---

## 一、服务器侧准备（一次性）

### 1. 阿里云安全组放行端口

阿里云控制台 → 云服务器 ECS → 网络与安全 → **安全组** → 入方向 → 手动添加：

| 端口 | 用途 | 授权对象 |
|------|------|----------|
| 22 | SSH（部署用） | 建议只放行你自己的 IP |
| 80 | HTTP | 0.0.0.0/0 |
| 443 | HTTPS | 0.0.0.0/0 |

### 2. 1Panel 系统防火墙放行（最容易漏！）

1Panel → **系统 → 防火墙 → 端口规则** → 放行 `80`、`443`。

> 云服务器安全组是「外层防火墙」，1Panel 防火墙是「内层防火墙」，
> 两层都要放行，少一层就是浏览器一直转圈超时。

### 3. 安装 OpenResty

1Panel → **应用商店** → 搜 `OpenResty` → 安装。

1Panel 的建站功能依赖它（它是 Nginx 的增强版）。不装的话「创建网站」按钮点不下去。

### 4. 配置 SSH 免密登录（Mac 上执行）

```bash
# 已有密钥就跳过这行
ssh-keygen -t ed25519 -C "clay-blog-deploy"

# 把公钥传到服务器（按提示输入一次服务器密码，之后就不用了）
ssh-copy-id -p 22 root@你的服务器IP

# 验证：不需要输密码就能连上，说明成功
ssh root@你的服务器IP "echo ok"
```

---

## 二、1Panel 建站（一次性）

### 1. 创建静态站点

1Panel → **网站 → 创建网站 → 静态网站**，填写：

| 配置项 | 填写内容 |
|--------|----------|
| 主域名 | `saibo.me` |
| 其他域名 | `www.saibo.me`（有就加上） |
| 代号 | `saibo.me`（就用域名，好认） |
| 端口 | 默认 80 |

创建后，面板会自动生成站点目录和默认的 index.html / 404.html（后面会被我们的产物覆盖）。

### 2. 申请 SSL 证书

1Panel → **网站 → 证书 → 申请证书**：

- 主域名：`saibo.me`
- 备用域名：`www.saibo.me`
- 验证方式：**HTTP 验证**（面板自动完成，最省事）
- 邮箱：填你自己的，收到期提醒

### 3. 开启 HTTPS 并强制跳转

1Panel → 网站 → 点 `saibo.me` → **HTTPS 设置**：

- 启用 HTTPS ✅
- 选择刚申请的证书
- **强制 HTTPS** ✅（HTTP 请求 301 跳 HTTPS）

---

## 三、本地部署脚本

### 1. 修改配置

打开 `deploy.sh`，只改顶部这三行：

```bash
REMOTE_HOST="${DEPLOY_HOST:-root@47.98.xxx.xxx}"      # 换成你的服务器 IP
REMOTE_PORT="${DEPLOY_PORT:-22}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/1panel/apps/openresty/openresty/www/sites/saibo.me/index}"
```

> 也可以用环境变量覆盖，不改脚本本身：
> `DEPLOY_HOST=root@1.2.3.4 DEPLOY_DIR=/xxx/index ./deploy.sh`

### 2. 首次部署：先预演

```bash
./deploy.sh --dry-run
```

会显示哪些文件将新增、哪些将被删除。确认无误后再真正执行：

```bash
./deploy.sh
```

脚本会：构建 → 校验产物 → 检查 SSH 和远端目录 → 预演 → 让你确认 → 同步 → 校验远端 index.html。

### 3. 日常更新

写完文章、确认本地没问题后：

```bash
git add . && git commit -m "新文章" && git push
./deploy.sh --yes
```

`--yes` 跳过确认，因为日常更新改动都是可预期的。

---

## 四、Nginx 优化配置（可选但推荐）

1Panel → 网站 → 点 `saibo.me` → **配置文件**（改之前先点「备份」或复制一份原文）。

在 `server { }` 块内加入：

```nginx
# ===== Astro 静态站点缓存策略 =====
# 带 hash 的构建产物（文件名含内容指纹），可以永久缓存
location ^~ /_astro/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# 图片 / 字体
location ~* \.(jpg|jpeg|png|gif|webp|avif|svg|ico|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# HTML / RSS / sitemap：不缓存，保证文章更新立刻生效
location ~* \.(html|xml|json)$ {
    expires -1;
    add_header Cache-Control "no-cache, must-revalidate";
}

# Service Worker 必须每次校验，否则用户会一直看到旧页面
location ~* (service-worker|sw)\.js$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# 目录式 URL 兜底（Astro 默认输出 /path/index.html，一般不需要，加上更保险）
location / {
    try_files $uri $uri/index.html $uri.html /404.html =404;
}
```

⚠️ 注意：1Panel 生成的配置里**已经有一个 `location /` 块**，别写成两个冲突的 location，
直接把 `try_files` 那行合并进原有的块里即可。

保存后面板会提示重载 OpenResty，确认即可。

**检查 gzip 是否开启**：1Panel 的 OpenResty 通常默认开着。想确认的话，在配置文件的 `server` 块里看有没有 `gzip on;`，没有就加上：

```nginx
gzip on;
gzip_min_length 1k;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript
           text/xml application/xml application/xml+rss text/javascript image/svg+xml;
```

---

## 五、排障清单

| 现象 | 原因 | 解决 |
|------|------|------|
| 浏览器一直转圈、连接超时 | 两层防火墙至少有一层没放行 80/443 | 先查阿里云安全组，再查 1Panel 防火墙 |
| 403 Forbidden 或显示目录列表 | 文件没传到 `index/` 目录里，或里面没有 index.html | 检查路径；`ssh root@IP "ls 站点目录/index"` |
| 页面能开但样式全丢 | 资源 404，一般是放错目录层级 | 确认 `dist/` **里面的内容**（不是 dist 文件夹本身）在 index 目录下 |
| 更新后浏览器还是旧内容 | HTML/Service Worker 被缓存，或套了 CDN | 硬刷新（Cmd+Shift+R）；检查上面的缓存配置；CDN 侧刷新缓存 |
| 中文路径（如 `/tags/AI工具/`）404 | 文件名编码不一致 | 当前站点已验证无此问题。若日后出现，执行 `brew install rsync` 后重新部署（脚本会自动启用 `--iconv`） |
| 部署脚本报 SSH 连不上 | IP/端口/密钥不对，或安全组没放行 22 | `ssh -p 22 root@IP -v` 看具体报错 |
| 报错「远端目录不存在」 | 1Panel 里还没建站点，或路径填错 | 面板里点「网站目录」复制真实路径 |

---

## 六、项目相关信息（备查）

| 项 | 值 |
|----|-----|
| 站点地址 | `https://saibo.me`（定义在 `astro.config.mjs` 的 `site` 字段） |
| 构建命令 | `bun run build` |
| 产物目录 | `dist/` |
| Git 仓库 | `github.com/saibome/saibo` |
| 运行时 / 包管理器 | Bun（>= 1.2） |

> `astro.config.mjs` 里的 `site` 支持环境变量 `PUBLIC_SITE_URL` 覆盖，
> 本地 `.env` 已设为 `https://saibo.me`（`.env` 不进 Git，部署时以环境变量或默认值为准）。
