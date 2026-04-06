/**
 * GitHub Actions 定时调度器
 *
 * 合并管理多个定时任务（4 个 cron triggers）：
 * - UTC 17:00 = 01:00 北京: sub2api-daily-report
 * - UTC 01:00 = 09:00 北京: daily-tech-news + health-wellness + tianhe-wellness（隔天由 workflow 自行去重）
 * - UTC 02:00 = 10:00 北京: daily-ai-briefing
 * - UTC 12:00 = 20:00 北京: daily-beauty + daily-robot-insights(周一三五) + daily-psychology
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
  'daily-tech-news': {
    repo: 'lairulan/daily-tech-news',
    event_type: 'daily-tech-news',
    cron_hour: 1,   // UTC 01:00 = 09:00 北京时间（原 08:30，合并后推迟 30min）
    cron_minute: 0,
    description: '每日科技新闻 (09:00 北京时间)'
  },
  'health-wellness': {
    repo: 'lairulan/health-wellness-publisher',
    event_type: 'daily-wellness',
    cron_hour: 1,   // UTC 01:00 = 09:00 北京时间（与 tech-news 共用 cron）
    cron_minute: 0,
    description: '手工暖食小馆养生内容 (09:00 北京时间, 隔天由 workflow 去重)'
  },
  'tianhe-wellness': {
    repo: 'lairulan/tianhe-wellness-publisher',
    event_type: 'daily-tianhe-wellness',
    cron_hour: 1,   // UTC 01:00 = 09:00 北京时间（与 health-wellness 共用 cron）
    cron_minute: 0,
    description: '天合虹蕴养生内容 (09:00 北京时间, 隔天由 workflow 去重)'
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
    description: '每日艺术写真 (20:00 北京时间)'
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
    description: '心光馨语心理学文章 (20:00 北京时间)'
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

  // HTTP 请求处理（用于手动测试）
  async fetch(request, env, ctx) {
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

    // 触发所有任务
    if (url.pathname === '/trigger-all') {
      const results = {};
      for (const [name, job] of Object.entries(JOBS)) {
        results[name] = await triggerWorkflow(env, job.repo, job.event_type);
      }
      return jsonResponse({ results });
    }

    // 首页信息
    return jsonResponse({
      name: 'GitHub Actions 定时调度器',
      cron_triggers: 4,
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

async function triggerWorkflow(env, repo, eventType) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GITHUB_TOKEN not configured' };
  }

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
    } else {
      const text = await response.text();
      return {
        success: false,
        status: response.status,
        error: text
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
