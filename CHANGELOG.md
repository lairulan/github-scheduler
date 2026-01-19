# 更新日志

## [1.0.0] - 2026-01-19

### 新增
- 初始版本发布
- 支持通过 Cloudflare Workers Cron Triggers 精确触发 GitHub Actions
- 配置两个定时任务：
  - `daily-tech-news`: 每天 8:30 北京时间 (UTC 00:30)
  - `beauty-generator`: 每天 20:00 北京时间 (UTC 12:00)
- HTTP 接口功能：
  - `/health` - 健康检查
  - `/trigger?workflow=<name>` - 手动触发指定任务
  - `/trigger-all` - 触发所有任务
- 完整的部署文档

### 技术实现
- 使用 Cloudflare Workers 免费计划
- 通过 GitHub API `workflow_dispatch` 触发 Actions
- 支持多个 workflow 的统一管理

### 迁移说明
- 原 GitHub Actions 的 `schedule` 触发器已移除
- 改为通过 `workflow_dispatch` 接收外部触发
- 已更新的仓库：
  - `lairulan/daily-tech-news`
  - `lairulan/beauty-generator`
