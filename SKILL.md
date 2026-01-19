---
name: github-scheduler
version: 1.0.0
description: GitHub Actions 定时任务精确触发器
author: lairulan
triggers:
  - "github scheduler"
  - "定时触发"
  - "workflow 调度"
---

# GitHub Scheduler

使用 Cloudflare Workers Cron Triggers 精确触发 GitHub Actions workflow，解决 GitHub 原生定时任务的延迟问题。

## 功能特性

- **精确触发**: Cloudflare Cron 精确到分钟级别，无延迟
- **零成本**: 使用 Cloudflare Workers 免费计划
- **手动触发**: 支持通过 HTTP 接口手动触发任务
- **健康检查**: 内置健康检查端点

## 当前配置的任务

| 任务 | 执行时间 (北京) | 仓库 |
|------|----------------|------|
| AI科技财经日报 | 每天 8:30 | lairulan/daily-tech-news |
| 每日美女图 | 每天 20:00 | lairulan/beauty-generator |

## 快速使用

### 健康检查
```bash
curl https://github-scheduler.lairulan.workers.dev/health
```

### 手动触发
```bash
# AI科技财经日报
curl "https://github-scheduler.lairulan.workers.dev/trigger?workflow=daily-tech-news"

# 每日美女图
curl "https://github-scheduler.lairulan.workers.dev/trigger?workflow=beauty-generator"
```

### 查看日志
```bash
wrangler tail
```

## 添加新任务

1. 编辑 `worker.js` 中的 `WORKFLOWS` 对象
2. 在 `getWorkflowToTrigger` 函数中添加时间判断
3. 在 `wrangler.toml` 中添加 cron 表达式
4. 运行 `wrangler deploy` 重新部署

## 相关文档

- [部署指南](./README.md) - 完整的部署步骤
