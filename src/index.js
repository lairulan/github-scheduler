/**
 * GitHub Actions 定时调度器
 *
 * 合并管理多个定时任务：
 * - UTC 17:00 = 01:00 北京: sub2api-daily-report
 * - UTC 00:00 = 08:00 北京: tianhe-wellness
 * - UTC 02:00 = 10:00 北京: daily-ai-briefing
 * - UTC 12:30 = 20:30 北京: daily-beauty-i2i（图生图）
 * - UTC 12:00 = 20:00 北京: daily-beauty（文生图）+ daily-robot-insights(周一三五) + daily-psychology(周一三五)
 *
 * Disabled 2026-06-24:
 * - daily-tech-news public-account publisher
 *
 * Telegram 日报已迁移到 GitHub Actions (.github/workflows/daily-report.yml)
 */

// 任务配置
const JOBS = {
  'sub2api-daily-report': {
    repo: 'lairulan/sub2api-daily-report',
    event_type: 'sub2api-daily-report',
    cron_hour: 17,  // UTC 17:00 = 01:00 北京时间
    cron_minute: 0,
    description: 'Sub2API 服务器运营报告 (01:00 北京时间)'
  },
  'tianhe-wellness': {
    repo: 'lairulan/tianhe-wellness-publisher',
    event_type: 'daily-tianhe-wellness',
    cron_hour: 0,   // UTC 00:00 = 08:00 北京时间
    cron_minute: 0,
    description: '天合虹蕴养生内容 (08:00 北京时间)'
  },
  'daily-ai-briefing': {
    repo: 'lairulan/daily-ai-briefing',
    event_type: 'daily-ai-briefing',
    cron_hour: 2,   // UTC 02:00 = 10:00 北京时间
    cron_minute: 0,
    description: 'AI大事件邮件日报 (10:00 北京时间)'
  },
  'daily-beauty': {
    repo: 'lairulan/beauty-generator',
    event_type: 'daily-beauty',
    cron_hour: 12,  // UTC 12:00 = 20:00 北京时间（原 19:30，合并后推迟 30min）
    cron_minute: 0,
    description: '每日艺术写真·文生图 (20:00 北京时间)'
  },
  'daily-beauty-i2i': {
    repo: 'lairulan/beauty-img2img',
    event_type: 'daily-beauty-i2i',
    cron_hour: 12,  // UTC 12:30 = 20:30 北京时间
    cron_minute: 30,
    description: '每日艺术写真·图生图 (20:30 北京时间)'
  },
  'daily-robot-insights': {
    repo: 'lairulan/industrial-robot-insights',
    event_type: 'daily-robot-insights',
    cron_hour: 12,  // UTC 12:00 = 20:00 北京时间
    cron_minute: 0,
    weekdays: [1, 3, 5],  // 仅周一、三、五
    description: '工业机器人洞察 (20:00 北京时间, 周一三五)'
  },
  'daily-psychology': {
    repo: 'lairulan/teen-psychology-insights',
    event_type: 'daily-psychology',
    cron_hour: 12,  // UTC 12:00 = 20:00 北京时间
    cron_minute: 0,
    weekdays: [1, 3, 5],  // 仅周一、三、五
    description: '心光心理学文章 (20:00 北京时间, 周一三五)'
  }
};

export default {
  // 定时任务处理
  async scheduled(event, env, ctx) {
    const now = new Date(event.scheduledTime);
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay();

    console.log(`Scheduled event at UTC ${hour}:${String(minute).padStart(2, '0')}`);

    for (const [name, job] of Object.entries(JOBS)) {
      if (job.cron_hour === hour && Math.abs(job.cron_minute - minute) <= 5) {
        // 检查星期限制
        if (job.weekdays && !job.weekdays.includes(dayOfWeek)) {
          console.log(`Skipping ${name}: weekday ${dayOfWeek} not in [${job.weekdays}]`);
          continue;
        }
        console.log(`Triggering job: ${name}`);
        const result = await triggerWorkflow(env, job.repo, job.event_type);
        console.log(`${name} result:`, JSON.stringify(result));
      }
    }
  },

  // HTTP 请求处理（手动触发，需要 Bearer 认证）
  async fetch(request, env, ctx) {
    // 仅允许 POST 方法
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Bearer token 认证
    const authHeader = request.headers.get('Authorization') || '';
    const expectedToken = env.TRIGGER_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);

    // 手动触发特定任务
    if (url.pathname.startsWith('/trigger/')) {
      const jobName = url.pathname.replace('/trigger/', '');
      const job = JOBS[jobName];

      if (!job) {
        return jsonResponse({ error: `Unknown job: ${jobName}`, available: Object.keys(JOBS) }, 404);
      }

      const result = await triggerWorkflow(env, job.repo, job.event_type);
      return jsonResponse({ job: jobName, ...result });
    }

    // 触发所有任务（保留 weekday 门控）
    if (url.pathname === '/trigger-all') {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const results = {};
      for (const [name, job] of Object.entries(JOBS)) {
        if (job.weekdays && !job.weekdays.includes(dayOfWeek)) {
          results[name] = { skipped: true, reason: `weekday ${dayOfWeek} not in [${job.weekdays}]` };
          continue;
        }
        results[name] = await triggerWorkflow(env, job.repo, job.event_type);
      }
      return jsonResponse({ results });
    }

    // 首页信息
    return jsonResponse({
      name: 'GitHub Actions 定时调度器',
      cron_triggers: Object.keys(JOBS).length,
      jobs: Object.entries(JOBS).map(([name, job]) => ({
        name,
        description: job.description,
        repo: job.repo,
        trigger_url: `/trigger/${name}`
      })),
      endpoints: {
        '/trigger/{job}': '触发指定任务',
        '/trigger-all': '触发所有任务'
      }
    });
  }
};

async function triggerWorkflow(env, repo, eventType, retries = 3) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GITHUB_TOKEN not configured' };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Worker-GitHub-Scheduler',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ event_type: eventType })
        }
      );

      if (response.status === 204) {
        return {
          success: true,
          message: 'Workflow triggered',
          repo,
          event_type: eventType,
          timestamp: new Date().toISOString()
        };
      }

      const text = await response.text();
      // 4xx 错误不重试（认证/权限失败重试无意义）
      if (response.status >= 400 && response.status < 500) {
        return { success: false, status: response.status, error: text };
      }
      // 5xx 继续重试
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt * 2));
      } else {
        return { success: false, status: response.status, error: text };
      }
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt * 2));
      } else {
        return { success: false, error: error.message };
      }
    }
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
