# Cloudflare Worker 部署详细指南

## 前置条件

- Node.js 16+ (检查: `node -v`)
- npm (检查: `npm -v`)

---

## 第一步：注册 Cloudflare 账户

如果你还没有 Cloudflare 账户：

1. 访问 https://dash.cloudflare.com/sign-up
2. 输入邮箱和密码注册
3. 验证邮箱

**免费账户即可**，Workers 免费额度完全够用。

---

## 第二步：安装 Wrangler CLI

Wrangler 是 Cloudflare 官方的命令行工具。

```bash
# 全局安装
npm install -g wrangler

# 验证安装
wrangler --version
```

预期输出类似: `wrangler 3.x.x`

---

## 第三步：登录 Cloudflare

```bash
wrangler login
```

执行后：
1. 终端显示一个链接
2. 浏览器自动打开（或手动复制链接打开）
3. 点击 "Allow" 授权
4. 看到 "Successfully logged in" 表示成功

**验证登录状态：**
```bash
wrangler whoami
```

---

## 第四步：创建 GitHub Personal Access Token

### 4.1 访问 GitHub Token 设置页面

直接打开: https://github.com/settings/tokens

或者手动导航:
1. GitHub 右上角头像 → Settings
2. 左侧菜单最下方 → Developer settings
3. Personal access tokens → Tokens (classic)

### 4.2 生成新 Token

1. 点击 **"Generate new token"** → **"Generate new token (classic)"**
2. 填写信息:
   - **Note**: `cloudflare-scheduler` (方便识别用途)
   - **Expiration**: 选择过期时间，推荐 90 days 或 No expiration
   - **Select scopes**: 勾选 **`workflow`** (在 repo 下面)

3. 滚动到底部，点击 **"Generate token"**

4. **立即复制 Token！** 页面刷新后就看不到了

Token 格式类似: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 第五步：进入项目目录

```bash
cd ~/.claude/skills/github-scheduler
```

确认文件存在：
```bash
ls -la
```

应该看到:
```
worker.js
wrangler.toml
README.md
DEPLOY_GUIDE.md
```

---

## 第六步：配置 GitHub Token Secret

```bash
wrangler secret put GITHUB_TOKEN
```

执行后：
1. 终端提示 "Enter a secret value:"
2. **粘贴你的 GitHub Token**（粘贴时不会显示字符，这是正常的）
3. 按回车

成功输出:
```
✨ Success! Uploaded secret GITHUB_TOKEN
```

---

## 第七步：部署 Worker

```bash
wrangler deploy
```

首次部署可能会问你是否创建新项目，输入 `y` 确认。

成功输出类似:
```
Uploaded github-scheduler (1.23 sec)
Published github-scheduler (0.45 sec)
  https://github-scheduler.你的账户.workers.dev
  schedule: 30 0 * * *
  schedule: 0 12 * * *
```

**记下这个 URL**，后面测试要用。

---

## 第八步：验证部署

### 8.1 健康检查

```bash
curl https://github-scheduler.你的账户.workers.dev/health
```

预期返回:
```json
{"status":"ok","workflows":["daily-tech-news","beauty-generator"],"timestamp":"..."}
```

### 8.2 手动触发测试

测试触发 AI科技财经日报:
```bash
curl "https://github-scheduler.你的账户.workers.dev/trigger?workflow=daily-tech-news"
```

成功返回:
```json
{"success":true,"message":"AI科技财经日报 触发成功"}
```

### 8.3 在 GitHub 验证

1. 打开 https://github.com/lairulan/daily-tech-news/actions
2. 应该看到一个新的 workflow run 正在执行或刚完成

---

## 第九步：查看 Cron 日志（可选）

### 实时日志
```bash
wrangler tail
```

这会显示实时的 Worker 执行日志，按 Ctrl+C 退出。

### Cloudflare Dashboard 查看
1. 访问 https://dash.cloudflare.com
2. 左侧菜单 → Workers & Pages
3. 点击 `github-scheduler`
4. 点击 "Logs" 标签

---

## 常见问题排查

### Q: `wrangler login` 浏览器没有自动打开？

手动复制终端显示的链接到浏览器打开。

### Q: 部署时报错 "authentication required"？

重新登录:
```bash
wrangler logout
wrangler login
```

### Q: 触发返回 401 Unauthorized？

GitHub Token 权限不足或已过期，重新生成并更新:
```bash
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

### Q: 触发返回 404 Not Found？

检查仓库名和 workflow 文件名是否正确。确认 workflow 文件确实存在于 `.github/workflows/` 目录。

### Q: 如何删除 Worker？

```bash
wrangler delete github-scheduler
```

---

## 完成后的架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              github-scheduler                        │    │
│  │                                                      │    │
│  │  Cron: 30 0 * * * (UTC)  ──→  daily-tech-news      │    │
│  │  Cron: 0 12 * * * (UTC)  ──→  beauty-generator     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ workflow_dispatch API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions                           │
│                                                              │
│  lairulan/daily-tech-news     → 每天 8:30 北京时间执行       │
│  lairulan/beauty-generator    → 每天 20:00 北京时间执行      │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速命令汇总

```bash
# 一键部署流程
cd ~/.claude/skills/github-scheduler
wrangler secret put GITHUB_TOKEN
wrangler deploy

# 测试
curl https://github-scheduler.你的账户.workers.dev/health
curl "https://github-scheduler.你的账户.workers.dev/trigger?workflow=daily-tech-news"

# 查看日志
wrangler tail
```
