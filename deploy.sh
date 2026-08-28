#!/usr/bin/env bash
#
# clay-blog 一键部署脚本
# 本地构建 Astro 静态站点 -> rsync 增量同步到服务器站点目录
#
# 用法:
#   ./deploy.sh              正常部署（会先构建、预演、再要求确认）
#   ./deploy.sh --yes        跳过确认直接部署
#   ./deploy.sh --build-only 只构建不同步
#   ./deploy.sh --dry-run    只预演，不传任何文件
#
set -euo pipefail

# ===================== 配置区（按你的服务器修改） =====================
REMOTE_HOST="${DEPLOY_HOST:-root@47.106.112.100}"                                  # 例: root@47.98.xxx.xxx
REMOTE_PORT="${DEPLOY_PORT:-22}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/1panel/www/sites/saibo/index}"
SSH_KEY="${DEPLOY_KEY:-}"                                                        # 留空则使用默认密钥/免密配置
# ====================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$PROJECT_DIR/dist"

# ---------- 颜色输出 ----------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_GRAY=$'\033[90m'
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_GRAY=""
fi

info()  { printf '%s[info]%s  %s\n'  "$C_BLUE"   "$C_RESET" "$*"; }
ok()    { printf '%s[ ok ]%s  %s\n'  "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf '%s[warn]%s  %s\n'  "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf '%s[fail]%s  %s\n'  "$C_RED"    "$C_RESET" "$*" >&2; }
title() { printf '\n%s%s%s\n'        "$C_BOLD" "$*" "$C_RESET"; }

# ---------- 参数 ----------
ASSUME_YES=0; BUILD_ONLY=0; DRY_RUN_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)     ASSUME_YES=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --dry-run)    DRY_RUN_ONLY=1 ;;
    -h|--help)    sed -n '2,11p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) err "未知参数: $arg"; exit 1 ;;
  esac
done

# ---------- 选择 rsync ----------
# macOS 自带的是 openrsync（2.6.9 兼容版），不支持 --iconv / --info 等参数。
# 若装了 Homebrew 版 rsync 3.x 则优先使用，避免中文文件名编码问题。
RSYNC_BIN="/usr/bin/rsync"
for cand in /opt/homebrew/bin/rsync /usr/local/bin/rsync; do
  [ -x "$cand" ] && RSYNC_BIN="$cand" && break
done

ICONV_OPT=""
if "$RSYNC_BIN" --help 2>&1 | grep -qi 'iconv'; then
  ICONV_OPT="--iconv=utf-8-mac,utf-8"   # macOS(NFD) -> Linux(NFC) 文件名归一化
fi

SSH_CMD="ssh -p $REMOTE_PORT -o StrictHostKeyChecking=accept-new"
[ -n "$SSH_KEY" ] && SSH_CMD="$SSH_CMD -i $SSH_KEY"

# ====================================================================
title "Step 1/4  配置检查"
# ====================================================================
if [[ "$REMOTE_HOST" == *"你的服务器IP"* ]]; then
  err "还没配置服务器地址。请编辑 deploy.sh 顶部的配置区，把 REMOTE_HOST / REMOTE_DIR 改成你的实际值。"
  exit 1
fi
info "远端目标: ${REMOTE_HOST}:${REMOTE_DIR}"
info "rsync:    $RSYNC_BIN $("$RSYNC_BIN" --version 2>&1 | head -1)"
[ -n "$ICONV_OPT" ] && info "文件名编码转换: 已启用（$ICONV_OPT）" \
                    || warn "当前 rsync 不支持 --iconv。若日后出现中文路径 404，请执行: brew install rsync"

# ====================================================================
title "Step 2/4  本地构建"
# ====================================================================
cd "$PROJECT_DIR"
rm -rf "$DIST_DIR"
pnpm run build > /tmp/clay-blog-build.log 2>&1 || {
  err "构建失败，日志见 /tmp/clay-blog-build.log："; tail -20 /tmp/clay-blog-build.log >&2; exit 1
}
ok "构建完成"

# 构建产物健全性检查
[ -f "$DIST_DIR/index.html" ] || { err "dist/index.html 缺失，产物异常，已中止。"; exit 1; }
[ -f "$DIST_DIR/404.html" ]   || warn "dist/404.html 缺失（1Panel 的 error_page 会用到它）"
FILE_COUNT=$(find "$DIST_DIR" -type f | wc -l | tr -d ' ')
DIST_SIZE=$(du -sh "$DIST_DIR" | awk '{print $1}')
ok "产物校验通过：$FILE_COUNT 个文件，共 $DIST_SIZE"

if [ "$BUILD_ONLY" -eq 1 ]; then
  ok "--build-only 模式，跳过同步。产物在: $DIST_DIR"
  exit 0
fi

# ====================================================================
title "Step 3/4  连通性与远端目录检查"
# ====================================================================
$SSH_CMD "$REMOTE_HOST" "test -d '$REMOTE_DIR'" 2>/dev/null || {
  err "SSH 连不上，或远端目录不存在: $REMOTE_DIR"
  err "请确认：1) 服务器 IP/端口/密钥正确  2) 1Panel 里已创建该静态站点  3) 路径填的是 index 目录"
  exit 1
}
ok "SSH 连通，远端目录存在"

# ====================================================================
title "Step 4/4  同步到服务器"
# ====================================================================
RSYNC_BASE=(-az --delete --human-readable
  --exclude='.DS_Store'
  --exclude='.well-known/'
  ${ICONV_OPT:+"$ICONV_OPT"}
  -e "$SSH_CMD")

# 先预演，看看这次会改动/删除什么
info "预演中..."
DRY_OUTPUT=$("$RSYNC_BIN" "${RSYNC_BASE[@]}" --itemize-changes --dry-run "$DIST_DIR/" "$REMOTE_HOST:$REMOTE_DIR/" 2>&1)
DELETED=$(printf '%s\n' "$DRY_OUTPUT" | grep -c '^\*deleting' || true)
CHANGED=$(printf '%s\n' "$DRY_OUTPUT" | grep -cE '^[<>ch]|^cd' || true)

printf '%s\n' "$DRY_OUTPUT" | grep -E '^\*deleting' | head -10 | sed 's/^/    /'
printf '%s\n%s\n' "----------------------------------------" \
  "  将新增/更新: $CHANGED  项      将删除: $DELETED  项"

if [ "$DRY_RUN_ONLY" -eq 1 ]; then
  info "--dry-run 模式，未传任何文件。"
  exit 0
fi

if [ "$CHANGED" -eq 0 ] && [ "$DELETED" -eq 0 ]; then
  ok "服务器已是最新，无需同步。"
  exit 0
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  # --delete 会删除服务器上多余的文件，删除超过 5 项时重点警告
  if [ "$DELETED" -gt 5 ]; then
    warn "本次将删除 $DELETED 项文件。如果这是首次部署，建议先备份服务器上的旧站点。"
  fi
  printf '%s确认同步？[y/N] %s' "$C_BOLD" "$C_RESET"
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) warn "已取消。"; exit 0 ;;
  esac
fi

"$RSYNC_BIN" "${RSYNC_BASE[@]}" --info=stats2 "$DIST_DIR/" "$REMOTE_HOST:$REMOTE_DIR/" 2>/dev/null \
  || "$RSYNC_BIN" "${RSYNC_BASE[@]}" "$DIST_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"

ok "同步完成"

# ---------- 收尾校验 ----------
REMOTE_INDEX=$($SSH_CMD "$REMOTE_HOST" "cat '$REMOTE_DIR/index.html' 2>/dev/null | head -c 200" || true)
if [ -n "$REMOTE_INDEX" ]; then
  ok "远端 index.html 校验正常"
  info "现在访问 https://saibo.me 看看效果吧"
else
  warn "远端 index.html 读取为空，建议登录 1Panel 检查站点目录权限"
fi
